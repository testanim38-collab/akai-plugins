import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { ScrollView, View } from 'react-native'
import { currentChannel, makeTab } from './index'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { ChannelTab, Settings } from './index'

const { Button, TableRow, TableRowGroup, TableSwitchRow, Text } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const settings = { tabs: [] as ChannelTab[], debug: false, ...(storage.use() ?? {}) }
  const tabs = settings.tabs
  const move = (index: number, delta: number) => {
    const next = [...tabs]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    storage.set({ tabs: next })
  }
  const pinCurrent = () => {
    const channel = currentChannel()
    if (!channel) return
    const tab = makeTab(channel as any)
    storage.set({ tabs: [...tabs.filter(x => x.channelId !== tab.channelId), tab] })
  }
  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <TableRowGroup title="Pinned tabs" description="Long-press a channel or DM and choose Add to Channel Tabs, or tap + Pin this in the tab bar above a channel.">
          {tabs.map((tab: ChannelTab, index: number) => (
            <TableRow
              key={tab.channelId}
              label={tab.label}
              subLabel={tab.guildId === '@me' ? 'Direct message' : 'Server channel'}
              trailing={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button size="sm" variant="secondary" text="↑" onPress={() => move(index, -1)} />
                  <Button size="sm" variant="secondary" text="↓" onPress={() => move(index, 1)} />
                  <Button size="sm" variant="destructive" text="Remove" onPress={() => storage.set({ tabs: tabs.filter(x => x.channelId !== tab.channelId) })} />
                </View>
              }
            />
          ))}
          {!tabs.length && <TableRow label="No tabs yet" subLabel="Pinned channels appear in a strip under the channel header." />}
        </TableRowGroup>
        <View style={{ gap: 8 }}>
          <Button text="Pin the channel I'm viewing" variant="primary" onPress={pinCurrent} />
        </View>
        <TableRowGroup title="Troubleshooting">
          <TableSwitchRow
            label="Debug long-press"
            subLabel="Shows a toast with the sheet name whenever a channel menu opens."
            value={settings.debug}
            onValueChange={(value: boolean) => storage.set({ debug: value })}
          />
        </TableRowGroup>
        <Text color="text-muted" variant="text-xs/normal">Tabs are stored locally and stay after restarting Discord.</Text>
      </ScrollView>
    </Page>
  )
}
