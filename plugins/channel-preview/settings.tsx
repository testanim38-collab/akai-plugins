import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { ScrollView } from 'react-native'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { PreviewMode, Settings } from './index'

const { TableRadioGroup, TableRadioRow, TableRowGroup, TableSwitchRow, Text } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const settings = { mode: 'preview' as PreviewMode, debug: false, ...(storage.use() ?? {}) }
  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <TableRowGroup title="Long-press behavior">
          <TableRadioGroup<PreviewMode> defaultValue={settings.mode} onChange={value => storage.set({ mode: value })}>
            <TableRadioRow value="preview" label="Open preview immediately" subLabel="Long-press opens the channel in preview mode. Use Return to go back and Actions for the channel menu." />
            <TableRadioRow value="menu" label="Open channel menu" subLabel="Keeps the normal menu and adds a Preview channel action." />
          </TableRadioGroup>
        </TableRowGroup>
        <TableRowGroup title="Troubleshooting">
          <TableSwitchRow
            label="Debug long-press"
            subLabel="Shows a toast with the sheet name whenever a channel menu opens."
            value={settings.debug}
            onValueChange={(value: boolean) => storage.set({ debug: value })}
          />
        </TableRowGroup>
        <Text color="text-muted" variant="text-xs/normal">Preview uses Discord's real channel screen, so messages and actions work normally. It temporarily navigates to that channel and shows a Return bar under the header; it is not a floating window.</Text>
      </ScrollView>
    </Page>
  )
}
