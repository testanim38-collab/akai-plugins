import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { ScrollView } from 'react-native'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { PreviewMode, Settings } from './index'

const { TableRadioGroup, TableRadioRow, TableRowGroup, TableSwitchRow, Text, TextInput } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const settings = { mode: 'preview' as PreviewMode, debug: false, hostName: '', ...(storage.use() ?? {}) }
  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <TableRowGroup title="Long-press behavior">
          <TableRadioGroup<PreviewMode> defaultValue={settings.mode} onChange={value => storage.set({ mode: value })}>
            <TableRadioRow value="preview" label="Open popup immediately" subLabel="Long-press opens a floating preview on top of your current channel." />
            <TableRadioRow value="menu" label="Open channel menu" subLabel="Keeps the normal menu and adds a Preview channel action." />
          </TableRadioGroup>
        </TableRowGroup>
        <TableRowGroup title="Troubleshooting">
          <TableSwitchRow
            label="Debug"
            subLabel="Shows which sheet was intercepted and which component hosts the popups."
            value={settings.debug}
            onValueChange={(value: boolean) => storage.set({ debug: value })}
          />
          <TextInput
            value={settings.hostName}
            onChange={(value: string) => storage.set({ hostName: value })}
            placeholder="Host component name (advanced, restart to apply)"
          />
        </TableRowGroup>
        <Text color="text-muted" variant="text-xs/normal">Previews are floating windows: drag the title bar, resize from the bottom-right corner, tap – to shrink to a bubble on the right edge, ⤢ to open the full channel, ✕ to close. Long-press a bubble to close it. Up to 5 at once.</Text>
      </ScrollView>
    </Page>
  )
}
