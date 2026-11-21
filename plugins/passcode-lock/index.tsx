import { AlertActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import SettingsComponent from './settings'

export type LockKind = 'server' | 'channel' | 'dm' | 'dm-tab'
export interface PasscodeRecord { salt: string; hash: string }
export interface LockEntry { kind: LockKind; targetId: string; passcode?: PasscodeRecord }
export interface Settings {
  master?: PasscodeRecord
  locks: LockEntry[]
  lockOnStartup: boolean
}

const DEFAULTS: Settings = { locks: [], lockOnStartup: false }
const ALERT_KEY = 'COMMUNITY_PASSCODE_LOCK'
const { AlertModal, AlertActionButton } = Design
function hashPasscode(code: string, salt: string) {
  let a = 0x811c9dc5
  let b = 0x9e3779b9
  const input = `${salt}:${code}`
  for (let round = 0; round < 4096; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) + round
      a = Math.imul(a ^ c, 0x01000193) >>> 0
      b = Math.imul(b ^ (c + a), 0x85ebca6b) >>> 0
      b ^= b >>> 13
    }
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}
function matches(code: string, record?: PasscodeRecord) {
  return !!record && hashPasscode(code, record.salt) === record.hash
}
function routeInfo(route: string) {
  const match = route.match(/(?:^|\/)channels\/([^/?#]+)(?:\/([^/?#]+))?/) 
  return match ? { guildId: match[1], channelId: match[2] } : undefined
}
function openPasscodePrompt(title: string, onSubmit: (code: string) => void, canCancel = true) {
  const Prompt = ({ onDone }: { onDone(code: string): void }) => {
    const [value, setValue] = useState('')
    return (
      <AlertModal
        title={title}
        content={<View style={{ paddingTop: 8 }}><TextInput value={value} onChangeText={setValue} placeholder="Passcode" secureTextEntry autoFocus autoCapitalize="none" autoCorrect={false} style={{ color: 'white', padding: 12, borderRadius: 10, backgroundColor: '#303136' }} /></View>}
        actions={<>{canCancel && <AlertActionButton variant="secondary" text="Cancel" />}<AlertActionButton variant="primary" text="Unlock" onPress={() => onDone(value)} /></>}
      />
    )
  }
  AlertActionCreators.openAlert(ALERT_KEY, <Prompt onDone={onSubmit} />)
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    const getSettings = (): Settings => ({ ...DEFAULTS, ...(jsonStorage.cache ?? {}) })
    const unlocked = new Set<string>()
    let activeKey: string | undefined

    const findLock = (guildId?: string, channelId?: string): { key: string; passcode?: PasscodeRecord } | undefined => {
      const state = getSettings()
      const channel = channelId ? (Stores.ChannelStore as any).getChannel?.(channelId) : undefined
      const isDm = guildId === '@me' || channel?.isDM?.() || channel?.isGroupDM?.()
      const candidates: Array<[string, LockEntry | undefined]> = [
        ...(channelId ? [[`channel:${channelId}`, state.locks.find(x => x.kind === 'channel' && x.targetId === channelId)] as [string, LockEntry | undefined]] : []),
        ...(channelId && isDm ? [[`dm:${channelId}`, state.locks.find(x => x.kind === 'dm' && x.targetId === channelId)] as [string, LockEntry | undefined]] : []),
        ...(guildId && guildId !== '@me' ? [[`server:${guildId}`, state.locks.find(x => x.kind === 'server' && x.targetId === guildId)] as [string, LockEntry | undefined]] : []),
        ...(isDm ? [['dm-tab:@me', state.locks.find(x => x.kind === 'dm-tab')] as [string, LockEntry | undefined]] : []),
      ]
      for (const [key, entry] of candidates) {
        if (!entry) continue
        const passcode = entry.passcode ?? state.master
        return { key, passcode }
      }
      return undefined
    }

    const guard = (guildId?: string, channelId?: string, proceed?: () => unknown) => {
      const target = findLock(guildId, channelId)
      if (!target) {
        if (activeKey) unlocked.delete(activeKey)
        activeKey = undefined
        return proceed?.()
      }
      if (unlocked.has(target.key)) {
        activeKey = target.key
        return proceed?.()
      }
      if (!target.passcode) {
        plugin.reportError('A locked destination has no configured passcode. Set a master passcode in plugin settings.')
        return
      }
      const ask = (title: string) => openPasscodePrompt(title, code => {
        if (!matches(code, target.passcode)) {
          ask('Incorrect passcode. Try again')
          return
        }
        unlocked.add(target.key)
        activeKey = target.key
        proceed?.()
      })
      ask('Enter passcode to continue')
      return
    }

    cleanup(
      getModules(
        withProps<{ transitionToGuild(guildId: string, channelId?: string): unknown }>('transitionToGuild'),
        module => cleanup(instead(module, 'transitionToGuild', function (args, original) {
          const [guildId, channelId] = args
          let result: unknown
          guard(guildId, channelId, () => { result = original.apply(this, args) })
          return result
        })),
      ),
      getModules(
        withProps<{ transitionTo(path: string): unknown }>('transitionTo'),
        module => cleanup(instead(module, 'transitionTo', function (args, original) {
          const info = typeof args[0] === 'string' ? routeInfo(args[0]) : undefined
          if (!info) return original.apply(this, args)
          let result: unknown
          guard(info.guildId, info.channelId, () => { result = original.apply(this, args) })
          return result
        })),
      ),
    )

    if (getSettings().lockOnStartup) {
      const master = getSettings().master
      if (master) {
        const ask = (title: string) => openPasscodePrompt(title, code => {
          if (!matches(code, master)) ask('Incorrect passcode. Try again')
        }, false)
        ask('Unlock Discord')
      }
    }
  },
  SettingsComponent,
})

