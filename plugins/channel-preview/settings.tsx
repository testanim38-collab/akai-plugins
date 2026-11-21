import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { ScrollView } from 'react-native'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './index'

const { TableRadioGroup, TableRadioRow, TableRowGroup, Text } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>
export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const mode = storage.use()?.mode ?? 'preview'
  return <Page><ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
    <TableRowGroup title="Long-press behavior">
      <TableRadioGroup defaultValue={mode} onChange={value => storage.set({ mode: value })}>
        <TableRadioRow value="preview" label="Open preview immediately" subLabel="Long-press opens the channel itself in preview mode. Use Return to go back and Actions to open the channel menu." />
        <TableRadioRow value="menu" label="Open channel menu" subLabel="Keeps the normal menu and adds a Preview channel action." />
      </TableRadioGroup>
    </TableRowGroup>
    <Text color="text-muted" variant="text-xs/normal">Mobile preview uses Discord's actual channel screen, so sending messages and channel interactions work normally. It temporarily navigates to that channel and provides a Return action; it is not a floating, side-by-side preview window.</Text>
  </ScrollView></Page>
}
