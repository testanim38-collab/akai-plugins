import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { after, before, instead } from '@valenced/patcher'
import { createElement, isValidElement, useEffect } from 'react'
import { Pressable, View } from 'react-native'
import SettingsComponent from './settings'
import {
  insertGroup,
  navigate,
  openSheet,
  resetNavigation,
  toast,
} from './sheet'
import type { FC, ReactElement, ReactNode } from 'react'

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
interface ChannelActionSheetProps {
  channel: Channel
  onClose?: () => void
}
type ChannelActionSheet = FC<ChannelActionSheetProps>
type SheetElement = ReactElement<{ children?: ReactNode; channel?: Channel }>

const DEFAULTS: Settings = { mode: 'preview', debug: false }
const NATIVE_KEY = 'AKAI_CHANNEL_PREVIEW_NATIVE_ACTIONS'
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

    // Discord renders the channel long-press sheet through this named module.
    // Patching the module directly is more reliable than guessing its openLazy key.
    cleanup(
      getModules(
        withName<ChannelActionSheet>('ChannelLongPressActionSheet'),
        mod => {
          const module = mod as { default: ChannelActionSheet }
          cleanup(
            instead(module, 'default', (args, Sheet) => {
              const tree = Reflect.apply(Sheet, undefined, args) as SheetElement | null
              if (!tree || !isValidElement(tree)) return tree

              try {
                const props = tree.props as ChannelActionSheetProps
                const channel = props.channel
                if (!channel?.id) return tree

                const Inner = tree.type
                if (typeof Inner !== 'function') return tree

                const closeSheet = () => {
                  if (typeof props.onClose === 'function') props.onClose()
                  else ActionSheetActionCreators.hideActionSheet()
                }
                const openActions = () => {
                  showNativeActions = undefined
                  openSheet(Inner, NATIVE_KEY, props)
                }

                if (mode() === 'preview') {
                  return createElement(function ChannelPreviewLauncher() {
                    useEffect(() => {
                      closeSheet()
                      startPreview(channel, openActions)
                    }, [])
                    return null
                  })
                }

                // The connected inner sheet owns the actual rows and receives the
                // channel props; render it inside a wrapper and append our action.
                const Wrapped: ChannelActionSheet = innerProps => {
                  const innerTree = (Inner as ChannelActionSheet)(innerProps) as ReactNode
                  const group = createElement(
                    ActionSheetRow.Group as any,
                    { key: 'akai-channel-preview' },
                    createElement(ActionSheetRow, {
                      label: 'Preview channel',
                      onPress: () => {
                        closeSheet()
                        startPreview(channel, openActions)
                      },
                    }),
                  )
                  const result = insertGroup(innerTree, group)
                  if (!result.ok && debug()) toast('Preview: could not find an action-sheet group')
                  return result.tree as ReactElement
                }
                Wrapped.displayName = 'AkaiChannelPreviewSheet'
                return createElement(Wrapped, { ...props, key: tree.key })
              } catch (error) {
                plugin.reportError(error)
                return tree
              }
            }),
          )
        },
        { returnNamespace: true },
      ),

      getModules(
        withProps<{ transitionToGuild(guildId: string, channelId?: string): unknown }>('transitionToGuild'),
        module => {
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
        },
      ),

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
