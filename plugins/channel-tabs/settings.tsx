import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { Pressable, ScrollView, View } from 'react-native'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { ChannelTab, Settings } from './index'

const { TableRowGroup, Text } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>
export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const tabs = storage.use()?.tabs ?? []
  const move = (index: number, delta: number) => {
    const next = [...tabs]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    storage.set({ tabs: next })
  }
  return <Page><ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
    <TableRowGroup title="Pinned tabs">
      <Text variant="text-sm/normal" color="text-muted">Long-press a channel or DM and choose Add to Channel Tabs. Tabs are stored locally and stay after restarting Discord.</Text>
      {tabs.map((tab: ChannelTab, index: number) => <View key={tab.channelId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
        <View style={{ flex: 1 }}><Text variant="text-md/medium">{tab.label}</Text><Text color="text-muted" variant="text-xs/normal">{tab.guildId === '@me' ? 'Direct message' : 'Server channel'}</Text></View>
        <Pressable onPress={() => move(index, -1)}><Text color="text-link">↑</Text></Pressable>
        <Pressable onPress={() => move(index, 1)}><Text color="text-link">↓</Text></Pressable>
        <Pressable onPress={() => storage.set({ tabs: tabs.filter(x => x.channelId !== tab.channelId) })}><Text color="text-feedback-critical">Remove</Text></Pressable>
      </View>)}
      {!tabs.length && <Text color="text-muted" variant="text-sm/normal">No tabs yet.</Text>}
    </TableRowGroup>
  </ScrollView></Page>
}
