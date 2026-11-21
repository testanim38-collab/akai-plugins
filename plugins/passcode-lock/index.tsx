import { AlertActionCreators, ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores, onFluxEventDispatched } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import { matches } from './hash'
import SettingsComponent from './settings'
import { isDmChannel, recipientIds } from './stores'
import type { PasscodeRecord } from './hash'

export type LockKind = 'server' | 'channel' | 'dm' | 'dm-tab'
export type { PasscodeRecord }
export interface LockEntry {
  kind: LockKind
  targetId: string
  userId?: string
  label?: string
  passcode?: PasscodeRecord
}
export interface Settings {
  master?: PasscodeRecord
  locks: LockEntry[]
  lockOnStartup: boolean
  relockAfter: number
}

const DEFAULTS: Settings = { locks: [], lockOnStartup: false, relockAfter: 1 }
const ALERT_KEY = 'COMMUNITY_PASSCODE_LOCK'
const { AlertModal, Button, Text, TextInput } = Design

interface PromptProps {
  title: string
  subtitle?: string
  cancellable: boolean
  verify(code: string): boolean
  onSuccess(): void
  onCancel(): void
  onMount?(): void
}

function PasscodePrompt({ title, subtitle, cancellable, verify, onSuccess, onCancel, onMount }: PromptProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  useEffect(() => {
    onMount?.()
  }, [])
  const submit = () => {
    if (verify(value)) {
      onSuccess()
      return
    }
    setValue('')
    setError('Incorrect passcode. Try again.')
  }
  return (
    <AlertModal
      title={title}
      content={
        <View style={{ gap: 12, paddingTop: 4 }}>
          {subtitle ? (
            <Text variant="text-sm/normal" color="text-muted">
              {subtitle}
            </Text>
          ) : null}
          <TextInput
            value={value}
            onChange={(next: string) => {
              setValue(next)
              setError(undefined)
            }}
            placeholder="Passcode"
            secureTextEntry
            autoFocus
            status={error ? 'error' : 'default'}
            errorMessage={error}
            returnKeyType="done"
          />
        </View>
      }
      actions={
        <View style={{ gap: 8 }}>
          <Button variant="primary" text="Unlock" onPress={submit} />
          {cancellable ? <Button variant="secondary" text="Cancel" onPress={onCancel} /> : null}
        </View>
      }
    />
  )
}

interface AskOptions {
  title: string
  subtitle?: string
  passcode: PasscodeRecord
  cancellable: boolean
  onSuccess(): void
  onCancel?(): void
  onMount?(): void
}
interface Target {
  key: string
  passcode?: PasscodeRecord
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    const getSettings = (): Settings => ({ ...DEFAULTS, ...(jsonStorage.cache ?? {}) })
    const unlocked = new Set<string>()
    let appLocked = false
    let appPromptMounted = false
    let promptOpen = false
    let promptToken = 0
    let leftAt: number | undefined
    let stopped = false

    const toast = (text: string) => {
      try {
        ToastActionCreators.open('COMMUNITY_PASSCODE_LOCK_TOAST', { text })
      } catch {}
    }

    const ask = (options: AskOptions) => {
      const token = ++promptToken
      let finished = false
      promptOpen = true
      const finish = () => {
        finished = true
        promptOpen = false
        AlertActionCreators.dismissAlert(ALERT_KEY)
      }
      const element = (
        <PasscodePrompt
          title={options.title}
          subtitle={options.subtitle}
          cancellable={options.cancellable}
          verify={code => matches(code, options.passcode)}
          onSuccess={() => {
            finish()
            options.onSuccess()
          }}
          onCancel={() => {
            finish()
            options.onCancel?.()
          }}
          onMount={options.onMount}
        />
      )
      try {
        AlertActionCreators.openAlert(
          ALERT_KEY,
          element,
          () => {
            if (finished || token !== promptToken || stopped) return
            promptOpen = false
            if (options.cancellable) options.onCancel?.()
            else setTimeout(() => !stopped && ask(options), 150)
          },
          { dismissable: options.cancellable },
        )
      } catch (error) {
        promptOpen = false
        plugin.reportError(error)
      }
    }

    const targetsFor = (guildId?: string | null, channelId?: string | null): Target[] => {
      const state = getSettings()
      const channel = channelId ? (Stores.ChannelStore as any)?.getChannel?.(channelId) : undefined
      const channelGuild = channel?.guild_id ?? channel?.guildId ?? undefined
      const realGuild = guildId && guildId !== '@me' ? guildId : channelGuild
      const inDm = !realGuild && (guildId === '@me' || isDmChannel(channel) || (!!channel && !channelGuild))
      const out: Target[] = []
      const add = (key: string, entry?: LockEntry) => {
        if (entry) out.push({ key, passcode: entry.passcode ?? state.master })
      }
      if (channelId) {
        add(`channel:${channelId}`, state.locks.find(x => x.kind === 'channel' && x.targetId === channelId))
      }
      if (inDm && channelId) {
        const ids = recipientIds(channel)
        const entry = state.locks.find(
          x =>
            x.kind === 'dm' &&
            (x.targetId === channelId ||
              (ids.length === 1 && (x.targetId === ids[0] || x.userId === ids[0]))),
        )
        add(`dm:${entry?.targetId}`, entry)
      }
      if (realGuild) add(`server:${realGuild}`, state.locks.find(x => x.kind === 'server' && x.targetId === realGuild))
      if (inDm) add('dm-tab:@me', state.locks.find(x => x.kind === 'dm-tab'))
      return out
    }

    const showAppPrompt = () => {
      const master = getSettings().master
      if (!master) {
        appLocked = false
        return
      }
      ask({
        title: 'Unlock Discord',
        subtitle: 'Enter your passcode to continue.',
        passcode: master,
        cancellable: false,
        onMount: () => {
          appPromptMounted = true
        },
        onSuccess: () => {
          appLocked = false
          appPromptMounted = false
          setTimeout(enforceCurrent, 300)
        },
      })
    }

    const lockApp = () => {
      const state = getSettings()
      if (!state.lockOnStartup || !state.master) return
      appLocked = true
      appPromptMounted = false
      showAppPrompt()
      for (const delay of [600, 1500, 3000, 6000, 10000]) {
        const id = setTimeout(() => {
          if (appLocked && !appPromptMounted && !stopped) showAppPrompt()
        }, delay)
        cleanup(() => clearTimeout(id))
      }
    }

    function enforceCurrent() {
      if (stopped || appLocked || promptOpen) return
      const channelId = (Stores.SelectedChannelStore as any)?.getChannelId?.()
      if (!channelId) return
      const channel = (Stores.ChannelStore as any)?.getChannel?.(channelId)
      const pending = targetsFor(channel?.guild_id ?? channel?.guildId ?? '@me', channelId).find(x => !unlocked.has(x.key))
      if (!pending) return
      if (!pending.passcode) {
        toast('A locked destination has no passcode. Set a master passcode in plugin settings.')
        return
      }
      ask({
        title: 'Locked',
        subtitle: 'Enter your passcode to keep viewing this chat.',
        passcode: pending.passcode,
        cancellable: false,
        onSuccess: () => {
          unlocked.add(pending.key)
          setTimeout(enforceCurrent, 200)
        },
      })
    }

    const guard = (guildId: string | undefined, channelId: string | undefined, proceed: () => void) => {
      if (appLocked) {
        if (!promptOpen) showAppPrompt()
        return
      }
      const targets = targetsFor(guildId, channelId)
      const keys = new Set(targets.map(x => x.key))
      for (const key of [...unlocked]) if (!keys.has(key)) unlocked.delete(key)
      const pending = targets.find(x => !unlocked.has(x.key))
      if (!pending) {
        proceed()
        return
      }
      if (!pending.passcode) {
        toast('A locked destination has no passcode. Set a master passcode in plugin settings.')
        return
      }
      ask({
        title: 'Enter passcode',
        subtitle: 'This chat is locked.',
        passcode: pending.passcode,
        cancellable: true,
        onSuccess: () => {
          unlocked.add(pending.key)
          guard(guildId, channelId, proceed)
        },
      })
    }

    const routeInfo = (route: string) => {
      const match = route.match(/(?:^|\/)channels\/([^/?#]+)(?:\/([^/?#]+))?/)
      return match ? { guildId: match[1], channelId: match[2] } : undefined
    }

    cleanup(
      getModules(
        withProps<{ transitionToGuild(guildId: string, channelId?: string): unknown }>('transitionToGuild'),
        module =>
          cleanup(
            instead(module as any, 'transitionToGuild', function (this: unknown, args: any[], original: (...a: any[]) => unknown) {
              const [guildId, channelId] = args
              let result: unknown
              guard(guildId, channelId, () => {
                result = original.apply(this, args)
              })
              return result
            } as any),
          ),
      ),
      getModules(
        withProps<{ transitionTo(path: string): unknown }>('transitionTo'),
        module =>
          cleanup(
            instead(module as any, 'transitionTo', function (this: unknown, args: any[], original: (...a: any[]) => unknown) {
              const info = typeof args[0] === 'string' ? routeInfo(args[0]) : undefined
              if (!info) return original.apply(this, args)
              let result: unknown
              guard(info.guildId, info.channelId, () => {
                result = original.apply(this, args)
              })
              return result
            } as any),
          ),
      ),
      onFluxEventDispatched('CONNECTION_OPEN', payload => {
        if (appLocked && !appPromptMounted) showAppPrompt()
        setTimeout(enforceCurrent, 800)
        return payload
      }),
    )

    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') {
        if (leftAt === undefined) leftAt = Date.now()
        return
      }
      if (next !== 'active' || leftAt === undefined) return
      const elapsed = Date.now() - leftAt
      leftAt = undefined
      const state = getSettings()
      if (state.relockAfter < 0 || elapsed < state.relockAfter * 60000) return
      unlocked.clear()
      if (state.lockOnStartup && state.master) lockApp()
      else setTimeout(enforceCurrent, 300)
    })
    cleanup(() => subscription.remove())
    cleanup(() => {
      stopped = true
      AlertActionCreators.dismissAlert(ALERT_KEY)
    })

    lockApp()
    if (!getSettings().lockOnStartup) {
      for (const delay of [1500, 4000]) {
        const id = setTimeout(enforceCurrent, delay)
        cleanup(() => clearTimeout(id))
      }
    }
  },
  SettingsComponent,
})
