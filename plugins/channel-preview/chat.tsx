import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native'
import { toast } from './sheet'

interface MessageApi {
  fetchMessages(args: Record<string, unknown>): unknown
  sendMessage(channelId: string, message: Record<string, unknown>, ...rest: unknown[]): unknown
}
interface RestApi {
  post(args: { url: string; body: unknown }): Promise<unknown>
}

let msgApi: MessageApi | undefined
let restApi: RestApi | undefined
function messageApi() {
  if (!msgApi) [msgApi] = lookupModule(withProps<MessageApi>('fetchMessages', 'sendMessage')) as unknown as [MessageApi?]
  return msgApi
}
function rest() {
  if (!restApi) [restApi] = lookupModule(withProps<RestApi>('getAPIBaseURL', 'post')) as unknown as [RestApi?]
  return restApi
}

const store = (name: string): any => (Stores as any)[name]
const BG = '#313338'
const pick = (...v: any[]) => v.find(x => x !== undefined && x !== null && x !== '')

function readMessages(channelId: string): any[] {
  const c = store('MessageStore')?.getMessages?.(channelId)
  const list: any[] = c?.toArray?.() ?? c?._array ?? []
  return [...list].reverse() // newest first, for an inverted list
}

function nameOf(user: any) {
  return pick(user?.globalName, user?.global_name, user?.username, 'Unknown') as string
}

function avatarUrl(user: any) {
  if (user?.id && user?.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
  const idx = user?.id ? Number((BigInt(user.id) >> 22n) % 6n) : 0
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
}

function timeOf(m: any) {
  const t = m?.timestamp
  const d: Date = t?.toDate?.() ?? new Date(String(t))
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ms(m: any) {
  const t = m?.timestamp
  const d: Date = t?.toDate?.() ?? new Date(String(t))
  return d.getTime() || 0
}

function clean(content: string, message: any) {
  const users = store('UserStore')
  const channels = store('ChannelStore')
  const mentionNames: Record<string, string> = {}
  for (const u of message?.mentions ?? []) if (u?.id) mentionNames[u.id] = nameOf(u)
  return String(content ?? '')
    .replace(/<@!?(\d+)>/g, (_, id) => `@${mentionNames[id] ?? nameOf(users?.getUser?.(id) ?? { username: 'user' })}`)
    .replace(/<#(\d+)>/g, (_, id) => `#${channels?.getChannel?.(id)?.name ?? 'channel'}`)
    .replace(/<@&(\d+)>/g, '@role')
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
}

function fit(width?: number, height?: number, max = 240) {
  if (!width || !height) return { width: max, height: max * 0.6 }
  const scale = Math.min(1, max / width)
  return { width: width * scale, height: Math.min(height * scale, 320) }
}

function ImageBox({ uri, width, height }: { uri: string; width?: number; height?: number }) {
  const size = fit(width, height)
  return <Image source={{ uri }} resizeMode="cover" style={{ ...size, borderRadius: 8, backgroundColor: '#1e1f22', marginTop: 4 }} />
}

function Embed({ embed }: { embed: any }) {
  const color = typeof embed.color === 'number' ? `#${embed.color.toString(16).padStart(6, '0')}` : (embed.color ?? '#202225')
  const title = pick(embed.title, embed.rawTitle)
  const desc = pick(embed.description, embed.rawDescription)
  const img = embed.image ?? embed.thumbnail
  const uri = pick(img?.proxyURL, img?.proxy_url, img?.url)
  const videoThumb = embed.video ? pick(embed.thumbnail?.proxyURL, embed.thumbnail?.proxy_url, embed.thumbnail?.url) : undefined
  const author = embed.author?.name
  const fields: any[] = embed.fields ?? []
  const isBareImage = embed.type === 'image' || embed.type === 'gifv'
  if (isBareImage && uri) return <ImageBox uri={uri} width={img?.width} height={img?.height} />
  return (
    <View style={{ marginTop: 4, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', backgroundColor: '#2b2d31', maxWidth: 300 }}>
      <View style={{ width: 4, backgroundColor: color }} />
      <View style={{ flex: 1, padding: 8, gap: 3 }}>
        {embed.provider?.name ? <Text style={{ color: '#949ba4', fontSize: 11 }}>{embed.provider.name}</Text> : null}
        {author ? <Text style={{ color: '#dbdee1', fontSize: 12, fontWeight: '600' }}>{author}</Text> : null}
        {title ? <Text style={{ color: '#00a8fc', fontSize: 14, fontWeight: '700' }}>{title}</Text> : null}
        {desc ? <Text style={{ color: '#dbdee1', fontSize: 13 }}>{clean(desc, {})}</Text> : null}
        {fields.map((f, i) => (
          <View key={i}>
            <Text style={{ color: '#f2f3f5', fontSize: 12, fontWeight: '700' }}>{pick(f.name, f.rawName)}</Text>
            <Text style={{ color: '#dbdee1', fontSize: 13 }}>{pick(f.value, f.rawValue)}</Text>
          </View>
        ))}
        {uri ? <ImageBox uri={(videoThumb ?? uri) as string} width={img?.width} height={img?.height} /> : null}
        {embed.footer?.text ? <Text style={{ color: '#949ba4', fontSize: 11 }}>{embed.footer.text}</Text> : null}
      </View>
    </View>
  )
}

function Attachment({ a }: { a: any }) {
  const uri = pick(a.proxy_url, a.proxyUrl, a.proxyURL, a.url)
  const type = String(a.content_type ?? a.contentType ?? '')
  const isImg = type.startsWith('image') || /\.(png|jpe?g|gif|webp)$/i.test(String(a.filename ?? ''))
  if (isImg && uri) return <ImageBox uri={uri} width={a.width} height={a.height} />
  return (
    <View style={{ marginTop: 4, padding: 8, borderRadius: 6, backgroundColor: '#2b2d31' }}>
      <Text style={{ color: '#00a8fc', fontSize: 13 }}>📎 {a.filename ?? 'file'}</Text>
    </View>
  )
}

function Row({ m, older }: { m: any; older?: any }) {
  const grouped = !!older && older.author?.id === m.author?.id && !m.messageReference && ms(m) - ms(older) < 7 * 60000
  const ref = m.referencedMessage
  const content = clean(m.content, m)
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingTop: grouped ? 1 : 10, gap: 8 }}>
      <View style={{ width: 36 }}>
        {grouped ? null : <Image source={{ uri: avatarUrl(m.author) }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1f22' }} />}
      </View>
      <View style={{ flex: 1 }}>
        {ref ? (
          <Text numberOfLines={1} style={{ color: '#949ba4', fontSize: 12 }}>↪ {nameOf(ref.author)}: {clean(ref.content, ref) || '[attachment]'}</Text>
        ) : null}
        {grouped ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ color: '#f2f3f5', fontWeight: '700', fontSize: 14 }}>{nameOf(m.author)}</Text>
            <Text style={{ color: '#949ba4', fontSize: 11 }}>{timeOf(m)}</Text>
          </View>
        )}
        {content ? <Text style={{ color: '#dbdee1', fontSize: 15 }}>{content}</Text> : null}
        {(m.attachments ?? []).map((a: any, i: number) => <Attachment key={a.id ?? i} a={a} />)}
        {(m.embeds ?? []).map((e: any, i: number) => <Embed key={i} embed={e} />)}
        {(m.stickerItems ?? []).map((s: any, i: number) => (
          <Text key={i} style={{ color: '#949ba4', fontSize: 12 }}>[sticker: {s.name}]</Text>
        ))}
        {(m.reactions ?? []).length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {m.reactions.map((r: any, i: number) => (
              <Text key={i} style={{ color: '#dbdee1', fontSize: 12, backgroundColor: '#2b2d31', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                {r.emoji?.id ? `:${r.emoji.name}:` : r.emoji?.name} {r.count}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function newNonce() {
  return String((BigInt(Date.now()) - 1420070400000n) * 4194304n)
}

async function sendText(channelId: string, content: string) {
  const r = rest()
  if (r) {
    try {
      await r.post({ url: `/channels/${channelId}/messages`, body: { content, tts: false, nonce: newNonce() } })
      return
    } catch (error) {
      if (!messageApi()) throw error
    }
  }
  const api = messageApi()
  if (!api) throw new Error('No message API found')
  await api.sendMessage(channelId, { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] })
}

export default function PreviewChat({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<any[]>(() => readMessages(channelId))
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  useEffect(() => {
    const refresh = () => setMessages(readMessages(channelId))
    try {
      messageApi()?.fetchMessages({ channelId, limit: 50 })
    } catch {}
    refresh()
    const s = store('MessageStore')
    s?.addChangeListener?.(refresh)
    const timer = setInterval(refresh, 1500)
    return () => {
      s?.removeChangeListener?.(refresh)
      clearInterval(timer)
    }
  }, [channelId])

  const loadOlder = () => {
    if (loadingOlder || !messages.length) return
    setLoadingOlder(true)
    try {
      messageApi()?.fetchMessages({ channelId, limit: 50, before: messages[messages.length - 1].id })
    } catch {}
    setTimeout(() => setLoadingOlder(false), 1500)
  }

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await sendText(channelId, content)
      setText('')
    } catch (error: any) {
      toast(`Could not send: ${error?.body?.message ?? error?.message ?? 'unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  const data = useMemo(() => messages, [messages])

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        inverted
        data={data}
        keyExtractor={m => String(m.id)}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={{ color: '#949ba4', textAlign: 'center', marginTop: 24, transform: [{ scaleY: -1 }] }}>Loading messages…</Text>}
        renderItem={({ item, index }) => <Row m={item} older={data[index + 1]} />}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 6, gap: 6, backgroundColor: '#2b2d31' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          blurOnSubmit={false}
          placeholder="Message"
          placeholderTextColor="#949ba4"
          returnKeyType="send"
          style={{ flex: 1, color: '#f2f3f5', backgroundColor: '#383a40', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
        />
        <Pressable onPress={send} hitSlop={8} style={{ padding: 8, opacity: sending ? 0.5 : 1 }}>
          <Text style={{ color: '#5865f2', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </View>
  )
}
