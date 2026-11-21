import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { createRecord } from './hash'
import { channelName, currentChannel, dmLabel, guildName, listDms, listGuilds, resolveDm, userName } from './stores'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { LockEntry, LockKind, Settings } from './index'
import type { Named } from './stores'

const { Button, TableRadioGroup, TableRadioRow, TableRow, TableRowGroup, TableSwitchRow, Text, TextInput } = Design
type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

const KINDS: Array<{ value: LockKind; label: string; sub: string }> = [
  { value: 'server', label: 'Server', sub: 'Every channel in a server' },
  { value: 'channel', label: 'Channel', sub: 'One server channel' },
  { value: 'dm', label: 'Direct message', sub: 'One person or group chat' },
  { value: 'dm-tab', label: 'All DMs', sub: 'The whole DM list and every DM' },
]
const RELOCK: Array<{ value: number; label: string }> = [
  { value: -1, label: 'Never' },
  { value: 0, label: 'Immediately' },
  { value: 1, label: 'After 1 minute' },
  { value: 5, label: 'After 5 minutes' },
  { value: 15, label: 'After 15 minutes' },
]
const ID_PATTERN = /^\d{17,20}$/

function describe(entry: LockEntry) {
  if (entry.kind === 'dm-tab') return 'All DMs'
  if (entry.kind === 'server') return guildName(entry.targetId) ?? entry.label ?? entry.targetId
  if (entry.kind === 'channel') return channelName(entry.targetId) ?? entry.label ?? entry.targetId
  return entry.label ?? (entry.userId ? userName(entry.userId) : entry.targetId)
}

export default function SettingsComponent({ api: { jsonStorage: storage } }: Props) {
  const settings: Settings = { locks: [], lockOnStartup: false, relockAfter: 1, ...(storage.use() ?? {}) }
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passError, setPassError] = useState<string>()
  const [kind, setKind] = useState<LockKind>('server')
  const [query, setQuery] = useState('')
  const [manualId, setManualId] = useState('')
  const [selected, setSelected] = useState<Named>()
  const [override, setOverride] = useState('')
  const [addError, setAddError] = useState<string>()

  const guilds = useMemo(() => listGuilds(), [kind])
  const dms = useMemo(() => listDms(), [kind])
  const options = useMemo(() => {
    const source = kind === 'server' ? guilds : kind === 'dm' ? dms : []
    const needle = query.trim().toLowerCase()
    return source.filter(item => !needle || item.name.toLowerCase().includes(needle) || item.id.includes(needle)).slice(0, 8)
  }, [kind, guilds, dms, query])

  const saveMaster = () => {
    if (pass.length < 4) return setPassError('Use at least 4 characters.')
    if (pass !== confirm) return setPassError('Passcodes do not match.')
    storage.set({ master: createRecord(pass) })
    setPass('')
    setConfirm('')
    setPassError(undefined)
  }

  const chooseKind = (next: LockKind) => {
    setKind(next)
    setSelected(undefined)
    setQuery('')
    setManualId('')
    setAddError(undefined)
  }

  const useCurrent = () => {
    const channel = currentChannel()
    if (!channel?.id) return setAddError('Open a channel first, then come back here.')
    setSelected({ id: String(channel.id), name: channel.name ? `#${channel.name}` : String(channel.id) })
    setAddError(undefined)
  }

  const addLock = () => {
    setAddError(undefined)
    let entry: LockEntry
    if (kind === 'dm-tab') {
      entry = { kind, targetId: '@me', label: 'All DMs' }
    } else {
      let target = selected
      const typed = manualId.trim()
      if (!target && typed) {
        if (!ID_PATTERN.test(typed)) return setAddError('IDs are 17 to 20 digits.')
        target = kind === 'dm' ? resolveDm(typed) : { id: typed, name: typed }
      }
      if (!target) return setAddError(kind === 'dm' ? 'Pick a chat or enter a user ID.' : 'Pick a target first.')
      entry = { kind, targetId: target.id, label: target.name }
      if (kind === 'dm' && target.userId) entry.userId = target.userId
    }
    if (override) {
      if (override.length < 4) return setAddError('Custom passcodes need at least 4 characters.')
      entry.passcode = createRecord(override)
    } else if (!settings.master) {
      return setAddError('Set a master passcode first, or enter a custom one.')
    }
    storage.set({
      locks: [...settings.locks.filter(x => !(x.kind === entry.kind && x.targetId === entry.targetId)), entry],
    })
    setSelected(undefined)
    setQuery('')
    setManualId('')
    setOverride('')
  }

  const showList = kind === 'server' || kind === 'dm'

  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <TableRowGroup title="Master passcode" description="Used for every lock unless a lock has its own passcode.">
          <TableRow label="Status" subLabel={settings.master ? 'A master passcode is set' : 'No master passcode yet'} />
        </TableRowGroup>
        <View style={{ gap: 10 }}>
          <TextInput
            value={pass}
            onChange={(value: string) => {
              setPass(value)
              setPassError(undefined)
            }}
            placeholder={settings.master ? 'New master passcode' : 'Create a master passcode'}
            secureTextEntry
          />
          <TextInput
            value={confirm}
            onChange={(value: string) => {
              setConfirm(value)
              setPassError(undefined)
            }}
            placeholder="Confirm passcode"
            secureTextEntry
            status={passError ? 'error' : 'default'}
            errorMessage={passError}
          />
          <Button text={settings.master ? 'Change master passcode' : 'Save master passcode'} variant="primary" onPress={saveMaster} />
        </View>

        <TableRowGroup title="App lock">
          <TableSwitchRow
            label="Ask for passcode when Discord opens"
            subLabel={settings.master ? 'Shown on launch and when you come back to the app.' : 'Set a master passcode first.'}
            value={settings.lockOnStartup && !!settings.master}
            disabled={!settings.master}
            onValueChange={(value: boolean) => storage.set({ lockOnStartup: value })}
          />
        </TableRowGroup>
        <TableRowGroup title="Lock again after leaving the app">
          <TableRadioGroup<number> defaultValue={settings.relockAfter} onChange={value => storage.set({ relockAfter: value })}>
            {RELOCK.map(item => (
              <TableRadioRow key={item.value} value={item.value} label={item.label} />
            ))}
          </TableRadioGroup>
        </TableRowGroup>

        <TableRowGroup title="Add a lock">
          <TableRadioGroup<LockKind> defaultValue={kind} onChange={chooseKind}>
            {KINDS.map(item => (
              <TableRadioRow key={item.value} value={item.value} label={item.label} subLabel={item.sub} />
            ))}
          </TableRadioGroup>
        </TableRowGroup>

        {showList ? (
          <TableRowGroup title={kind === 'server' ? 'Choose a server' : 'Choose a chat'}>
            {options.map(item => (
              <TableRow
                key={item.id}
                label={item.name}
                subLabel={item.id}
                trailing={selected?.id === item.id ? <Text color="text-link" variant="text-sm/semibold">Selected</Text> : undefined}
                onPress={() => {
                  setSelected(item)
                  setManualId('')
                }}
              />
            ))}
            {!options.length ? (
              <TableRow label={query ? 'No matches' : kind === 'dm' ? 'No DMs loaded yet' : 'No servers loaded yet'} subLabel="You can still enter an ID below." />
            ) : null}
          </TableRowGroup>
        ) : null}

        {showList ? (
          <View style={{ gap: 10 }}>
            <TextInput value={query} onChange={setQuery} placeholder="Search by name" isClearable onClear={() => setQuery('')} />
          </View>
        ) : null}

        {kind !== 'dm-tab' ? (
          <View style={{ gap: 10 }}>
            <TextInput
              value={manualId}
              onChange={(value: string) => {
                setManualId(value)
                setSelected(undefined)
              }}
              placeholder={kind === 'dm' ? 'Or enter a user ID or DM channel ID' : kind === 'server' ? 'Or enter a server ID' : 'Channel ID'}
            />
            {kind === 'channel' ? <Button text="Use the channel I'm viewing" variant="secondary" onPress={useCurrent} /> : null}
            {selected ? (
              <Text variant="text-sm/normal" color="text-muted">
                Selected: {selected.name}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <TextInput value={override} onChange={setOverride} placeholder="Optional: different passcode for this lock" secureTextEntry status={addError ? 'error' : 'default'} errorMessage={addError} />
          <Button text="Add lock" variant="primary" onPress={addLock} />
        </View>

        <TableRowGroup title="Active locks">
          {settings.locks.map(entry => (
            <TableRow
              key={`${entry.kind}:${entry.targetId}`}
              label={describe(entry)}
              subLabel={`${KINDS.find(x => x.value === entry.kind)?.label ?? entry.kind} · ${entry.passcode ? 'Own passcode' : 'Master passcode'}`}
              trailing={<Button size="sm" variant="destructive" text="Remove" onPress={() => storage.set({ locks: settings.locks.filter(x => x !== entry) })} />}
            />
          ))}
          {!settings.locks.length ? <TableRow label="No locks yet" subLabel="Add one above." /> : null}
        </TableRowGroup>

        <Text color="text-muted" variant="text-xs/normal">
          This is a local privacy screen, not strong account or device security. Someone with access to the device storage or the running client may bypass it, and it does not lock notifications. If you forget your master passcode, you will need to disable plugins from Discord's safe mode or clear the app data.
        </Text>
      </ScrollView>
    </Page>
  )
}
