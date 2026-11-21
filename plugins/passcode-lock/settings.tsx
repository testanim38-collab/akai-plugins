import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { LockEntry, LockKind, PasscodeRecord, Settings } from './index'

const { Text, TableRowGroup, TableSwitchRow } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>
const kinds: Array<{ value: LockKind; label: string }> = [
  { value: 'server', label: 'Server' },
  { value: 'channel', label: 'Channel' },
  { value: 'dm', label: 'DM' },
  { value: 'dm-tab', label: 'All DMs' },
]
function createRecord(code: string): PasscodeRecord {
  const salt = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  let a = 0x811c9dc5, b = 0x9e3779b9
  const input = `${salt}:${code}`
  for (let round = 0; round < 4096; round++) for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i) + round
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ (c + a), 0x85ebca6b) >>> 0
    b ^= b >>> 13
  }
  return { salt, hash: `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}` }
}
const fieldStyle = { color: 'white', backgroundColor: '#303136', borderRadius: 10, padding: 12, marginTop: 8 } as const

export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const settings: Settings = { locks: [], lockOnStartup: false, ...(storage.use() ?? {}) }
  const [master, setMaster] = useState('')
  const [targetId, setTargetId] = useState('')
  const [kind, setKind] = useState<LockKind>('server')
  const [override, setOverride] = useState('')
  const saveMaster = () => {
    if (master.length < 4) return
    storage.set({ master: createRecord(master) })
    setMaster('')
  }
  const addLock = () => {
    if (kind !== 'dm-tab' && !/^\d{17,20}$/.test(targetId.trim())) return
    const entry: LockEntry = { kind, targetId: kind === 'dm-tab' ? '@me' : targetId.trim() }
    if (override) entry.passcode = createRecord(override)
    storage.set({ locks: [...settings.locks.filter(x => !(x.kind === entry.kind && x.targetId === entry.targetId)), entry] })
    setTargetId(''); setOverride('')
  }
  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <TableRowGroup title="Master passcode">
          <Text variant="text-sm/normal" color="text-muted">Set the default passcode. Individual destinations can use this or their own passcode.</Text>
          <TextInput value={master} onChangeText={setMaster} placeholder={settings.master ? 'Enter a new master passcode' : 'Create a master passcode'} secureTextEntry style={fieldStyle} />
          <Pressable onPress={saveMaster} style={{ padding: 12, borderRadius: 10, backgroundColor: '#5865f2', marginTop: 10 }}><Text color="text-normal" variant="text-md/semibold">Save master passcode</Text></Pressable>
          <TableSwitchRow label="Lock Discord when it starts" value={settings.lockOnStartup} onValueChange={v => storage.set({ lockOnStartup: v })} />
        </TableRowGroup>
        <TableRowGroup title="Destination locks">
          <Text variant="text-sm/normal" color="text-muted">Choose a destination. Enter its ID, except for All DMs. Leave the override blank to use the master passcode.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {kinds.map(item => <Pressable key={item.value} onPress={() => setKind(item.value)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: kind === item.value ? '#5865f2' : '#303136' }}><Text color="text-normal">{item.label}</Text></Pressable>)}
          </View>
          {kind !== 'dm-tab' && <TextInput value={targetId} onChangeText={setTargetId} placeholder={`${kind === 'server' ? 'Server' : kind === 'channel' ? 'Channel' : 'DM'} ID`} autoCapitalize="none" style={fieldStyle} />}
          <TextInput value={override} onChangeText={setOverride} placeholder="Optional different passcode" secureTextEntry style={fieldStyle} />
          <Pressable onPress={addLock} style={{ padding: 12, borderRadius: 10, backgroundColor: '#5865f2', marginTop: 10 }}><Text color="text-normal" variant="text-md/semibold">Add / update lock</Text></Pressable>
          {settings.locks.map(entry => <View key={`${entry.kind}:${entry.targetId}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
            <View style={{ flex: 1 }}><Text variant="text-md/medium">{kinds.find(x => x.value === entry.kind)?.label ?? entry.kind}</Text><Text color="text-muted" variant="text-xs/normal">{entry.kind === 'dm-tab' ? 'All DMs tab' : entry.targetId} · {entry.passcode ? 'Custom passcode' : 'Master passcode'}</Text></View>
            <Pressable onPress={() => storage.set({ locks: settings.locks.filter(x => x !== entry) })} style={{ padding: 10 }}><Text color="text-feedback-critical">Remove</Text></Pressable>
          </View>)}
        </TableRowGroup>
        <Text color="text-muted" variant="text-xs/normal">This is a local privacy screen, not strong account or device security. Someone with access to plugin storage or the running client may bypass it. It does not lock Android notifications.</Text>
      </ScrollView>
    </Page>
  )
}
