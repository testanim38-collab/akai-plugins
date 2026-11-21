import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { after, before } from '@valenced/patcher'
import { createElement, isValidElement, useEffect } from 'react'
import { Pressable, View } from 'react-native'
import SettingsComponent from './settings'
import {
  channelOf,
  insertGroup,
  isChannelSheet,
  navigate,
  openSheet,
  patchOpenLazy,
  resetNavigation,
  sheetName,
  toast,
  withBypass,
  wrapSheet,
} from './sheet'
import type { FC, ReactNode } from 'react'

export type PreviewMode = 'preview' | 'menu'
export interface Settings {
  mode: PreviewMode
  debug: boolean
}
interface Channel {
  id: string
  guild_id?: string | null
  name?: string
}

const DEFAULTS: Settings = { mode: 'preview', debug: false }
const NATIVE_KEY = 'CHANNEL_PREVIEW_NATIVE_ACTIONS'
const { ActionSheetRow, Text } = Design
let previewSession: { previousGuildId: string; previousChannelId?: string; target: Channel } | undefined
let showNativeActions: (() => void) | undefined

function startPreview(channel: Channel, openActions: () => void) {
  const selectedId = (Stores.SelectedChannelStore as any)?.getChannelId?.()
  const previous = selectedId ? (Stores.ChannelStore as any)?.getChannel?.(selectedId) : undefined
  previewSession = {
    previousGuildId: previous?.guild_id ?? previous?.guildId ?? '@me',
    previousChannelId: selectedId,
    target: channel,
  }
  showNativeActions = openActions
  if (!navigate(channel.guild_id ?? '@me', channel.id)) {
    previewSession = undefined
    showNativeActions = undefined
    toast('Could not open the preview')
    return
  }
  toast(`Previewing ${channel.name ? `#${channel.name}` : 'channel'}`)
}

function returnFromPreview() {
  const session = previewSession
  if (!session) return
  previewSession = undefined
  showNativeActions = undefined
  navigate(session.previousGuildId, session.previousChannelId)
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    const mode = () => jsonStorage.cache?.mode ?? DEFAULTS.mode
    const debug = () => !!jsonStorage.cache?.debug

    patchOpenLazy(({ key, props, component, bypass }) => {
      const channel = channelOf(props) as Channel | undefined
      if (debug() && channel) {
        toast(`preview: ${key} / ${sheetName(component) || 'unnamed'} / ${isChannelSheet(key, props, component) ? 'match' : 'skip'}`)
      }
      if (!channel || !isChannelSheet(key, props, component) || bypass) return undefined
      const openActions = () => {
        showNativeActions = undefined
        withBypass(() => openSheet(component, NATIVE_KEY, props))
      }
      if (mode() === 'preview') {
        return function PreviewLauncher() {
          useEffect(() => {
            ActionSheetActionCreators.hideActionSheet(key)
            startPreview(channel, openActions)
          }, [])
          return null
        }
      }
      return wrapSheet(component, tree => {
        try {
          const group = createElement(
            ActionSheetRow.Group as any,
            { key: 'akai-channel-preview' },
            createElement(ActionSheetRow, {
              label: 'Preview channel',
              onPress: () => {
                ActionSheetActionCreators.hideActionSheet(key)
                startPreview(channel, openActions)
              },
            }),
          )
          const result = insertGroup(tree, group)
          if (!result.ok && debug()) toast('preview: could not find where to insert the row')
          return result.tree
        } catch (error) {
          plugin.reportError(error)
          return tree
        }
      })
    }, cleanup)

    cleanup(
      getModules(withProps<{ transitionToGuild(guildId: string, channelId?: string): unknown }>('transitionToGuild'), module => {
        cleanup(
          before(module as any, 'transitionToGuild', ((args: [string, string?]) => {
            const [guildId, channelId] = args
            if (previewSession && (guildId !== (previewSession.target.guild_id ?? '@me') || channelId !== previewSession.target.id)) {
              previewSession = undefined
              showNativeActions = undefined
            }
            return args
          }) as any),
        )
      }),
      getModules(
        withName<FC>('ChannelHeader'),
        module => {
          const holder = module as any
          const injectToolbar = (tree: ReactNode) => {
            if (!previewSession || !isValidElement(tree)) return tree
            const session = previewSession
            const toolbar = createElement(
              View,
              {
                style: {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  backgroundColor: '#313338',
                },
              },
              createElement(
                View,
                { style: { flex: 1 } },
                createElement(Text, { variant: 'text-sm/semibold', color: 'text-normal' }, `Previewing ${session.target.name ? `#${session.target.name}` : 'channel'}`),
                createElement(Text, { variant: 'text-xs/normal', color: 'text-muted' }, 'This is the real channel. Messages and actions work normally.'),
              ),
              createElement(
                Pressable,
                { onPress: () => showNativeActions?.(), style: { padding: 8 } },
                createElement(Text, { color: 'text-link', variant: 'text-sm/semibold' }, 'Actions'),
              ),
              createElement(
                Pressable,
                { onPress: returnFromPreview, style: { padding: 8 } },
                createElement(Text, { color: 'text-link', variant: 'text-sm/semibold' }, 'Return'),
              ),
            )
            return createElement(View, { style: { width: '100%' } }, tree, toolbar)
          }
          if (typeof holder?.default === 'function') cleanup(after(holder, 'default', injectToolbar as any))
          else if (typeof holder?.default?.type === 'function') cleanup(after(holder.default, 'type', injectToolbar as any))
          else if (typeof holder?.type === 'function') cleanup(after(holder, 'type', injectToolbar as any))
        },
        { returnNamespace: true },
      ),
    )
  },
  stop() {
    previewSession = undefined
    showNativeActions = undefined
    resetNavigation()
  },
  SettingsComponent,
})
