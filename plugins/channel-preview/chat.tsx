import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'

interface MessageApi {
  fetchMessages(args: Record<string, unknown>): unknown
  sendMessage(channelId: string, message: Record<string, unknown>, ...rest: unknown[]): unknown
}

let api: MessageApi | undefined
function messageApi() {
  if (!api) {
    const [found] = lookupModule(withProps<MessageApi>('fetchMessages', 'sendMessage')) as unknown as [MessageApi?]
    api = found
  }
  return api
}

const store = (name: string): any => (Stores as any)[name]

function readMessages(channelId: string): any[] {
  const collection = store('MessageStore')?.getMessages?.(channelId)
  const list: any[] = collection?.toArray?.() ?? collection?._array ?? []
  return list.slice(-40)
}

function authorOf(message: any): string {
  const a = message?.author
  return a?.globalName ?? a?.global_name ?? a?.username ?? 'Unknown'
}

export default function PreviewChat({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<any[]>(() => readMessages(channelId))
  const [text, setText] = useState('')
  const list = useRef<FlatList<any>>(null)

  useEffect(() => {
    const refresh = () => setMessages(readMessages(channelId))
    try {
      messageApi()?.fetchMessages({ channelId, limit: 30 })
    } catch {}
    refresh()
    const ms = store('MessageStore')
    ms?.addChangeListener?.(refresh)
    // Fallback in case the store has no change listener.
    const timer = setInterval(refresh, 2000)
    return () => {
      ms?.removeChangeListener?.(refresh)
      clearInterval(timer)
    }
  }, [channelId])

  const send = () => {
    const content = text.trim()
    if (!content) return
    setText('')
    try {
      messageApi()?.sendMessage(channelId, { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] })
    } catch {}
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={m => String(m.id)}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ padding: 10, gap: 8 }}
        ListEmptyComponent={<Text style={{ color: '#949ba4', textAlign: 'center', marginTop: 24 }}>Loading messages…</Text>}
        renderItem={({ item }) => (
          <View>
            <Text style={{ color: '#f2f3f5', fontWeight: '600', fontSize: 13 }}>{authorOf(item)}</Text>
            <Text style={{ color: '#dbdee1', fontSize: 14 }}>
              {item.content || (item.attachments?.length ? '[attachment]' : item.embeds?.length ? '[embed]' : '')}
            </Text>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 6, gap: 6, backgroundColor: '#2b2d31' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder="Message"
          placeholderTextColor="#949ba4"
          returnKeyType="send"
          style={{ flex: 1, color: '#f2f3f5', backgroundColor: '#383a40', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
        />
        <Pressable onPress={send} hitSlop={8} style={{ padding: 6 }}>
          <Text style={{ color: '#5865f2', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </View>
  )
}
