import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { after, before, instead } from '@valenced/patcher'
import { createElement, isValidElement } from 'react'
import { Pressable, View } from 'react-native'
import SettingsComponent from './settings'
import type { FC, ReactElement, ReactNode } from 'react'

export type PreviewMode = 'preview' | 'menu'
export interface Settings { mode: PreviewMode }
interface Channel { id: string; guild_id?: string | null; name?: string; type?: number }
interface ChannelSheetProps { channel: Channel; onClose?: () => void; [key: string]: unknown }
type ChannelSheet = FC<ChannelSheetProps>
interface TransitionModule { transitionToGuild(guildId: string, channelId?: string): void }

const DEFAULTS: Settings = { mode: 'preview' }
const { ActionSheet, ActionSheetRow, Text } = Design
let previewSession: { previousGuildId: string; previousChannelId?: string; target: Channel } | undefined
let showNativeActions: (() => void) | undefined
let transition: TransitionModule['transitionToGuild'] | undefined

function transitionToGuild(guildId: string, channelId?: string) {
  if (!transition) transition = getModules(withProps<TransitionModule>('transitionToGuild'))[0]?.transitionToGuild
  transition?.(guildId, channelId)
}
function startPreview(channel: Channel, openActions?: () => void) {
  const selected = Stores.SelectedChannelStore as any
  const previousChannelId = selected.getChannelId?.()
  const previousChannel = previousChannelId ? (Stores.ChannelStore as any).getChannel?.(previousChannelId) : undefined
  const previousGuildId = previousChannel?.guild_id ?? previousChannel?.guildId ?? '@me'
  previewSession = { previousGuildId, previousChannelId, target: channel }
  showNativeActions = openActions
  transitionToGuild(channel.guild_id ?? '@me', channel.id)
}
function returnFromPreview() {
  const session = previewSession
  if (!session) return
  previewSession = undefined
  showNativeActions = undefined
  transitionToGuild(session.previousGuildId, session.previousChannelId)
}
function findActionSheet(node: unknown): ReactElement<{ children?: ReactNode }> | undefined {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) { const found = findActionSheet(child); if (found) return found }
    return
  }
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === ActionSheet) return element
  return findActionSheet(element.props?.children)
}
function addPreviewAction(tree: unknown, onPress: () => void) {
  const sheet = findActionSheet(tree)
  if (!sheet) return
  const group = createElement(ActionSheetRow.Group, null,
    createElement(ActionSheetRow, { label: 'Preview channel', onPress }),
  )
  const children = [sheet.props.children].flat().filter(Boolean)
  children.splice(Math.max(children.length - 1, 0), 0, group)
  sheet.props.children = children
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    const mode = () => jsonStorage.cache?.mode ?? DEFAULTS.mode
    cleanup(
      getModules(withProps<TransitionModule>('transitionToGuild'), module => {
        cleanup(before(module, 'transitionToGuild', args => {
          const [guildId, channelId] = args as [string, string?]
          if (previewSession && (guildId !== (previewSession.target.guild_id ?? '@me') || channelId !== previewSession.target.id)) {
            previewSession = undefined
            showNativeActions = undefined
          }
          return args
        }))
      }),
      getModules(withName<ChannelSheet>('ChannelLongPressActionSheet'), module => {
        cleanup(instead(module, 'default', (args, original) => {
          const props = args[0] as ChannelSheetProps | undefined
          const channel = props?.channel
          if (!channel?.id) return original.apply(undefined, args)
          const openActions = () => {
            showNativeActions = undefined
            ActionSheetActionCreators.openLazy(
              Promise.resolve({ default: () => original.apply(undefined, args) }),
              'CHANNEL_PREVIEW_NATIVE_ACTIONS',
            )
          }
          if (mode() === 'preview') {
            startPreview(channel, openActions)
            return null
          }
          const tree = original.apply(undefined, args)
          try { addPreviewAction(tree, () => startPreview(channel, openActions)) }
          catch (error) { plugin.reportError(error) }
          return tree
        }))
      }, { returnNamespace: true }),
      getModules(withName<FC>('ChannelHeader'), module => {
        const Component = module.default as any
        const injectPreviewToolbar = (tree: ReactNode) => {
          if (!previewSession || !isValidElement(tree)) return tree
          const session = previewSession
          const toolbar = createElement(View, {
            style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#313338' },
          },
            createElement(View, { style: { flex: 1 } },
              createElement(Text, { variant: 'text-sm/semibold', color: 'text-normal' }, `Previewing ${session.target.name ? `#${session.target.name}` : 'channel'}`),
              createElement(Text, { variant: 'text-xs/normal', color: 'text-muted' }, 'You are viewing the real channel. Messages and actions work normally.'),
            ),
            createElement(Pressable, { onPress: () => showNativeActions?.(), style: { padding: 8 } }, createElement(Text, { color: 'text-link', variant: 'text-sm/semibold' }, 'Actions')),
            createElement(Pressable, { onPress: returnFromPreview, style: { padding: 8 } }, createElement(Text, { color: 'text-link', variant: 'text-sm/semibold' }, 'Return')),
          )
          return createElement(View, { style: { width: '100%' } }, tree, toolbar)
        }
        if (typeof Component === 'function') cleanup(after(module, 'default', injectPreviewToolbar))
        else if (typeof Component?.type === 'function') cleanup(after(Component, 'type', injectPreviewToolbar))
      }, { returnNamespace: true }),
    )
  },
  stop() { previewSession = undefined; showNativeActions = undefined; transition = undefined },
  SettingsComponent,
})
