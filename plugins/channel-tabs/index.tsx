import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { after, instead } from '@valenced/patcher'
import { createElement, isValidElement } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import SettingsComponent from './settings'
import type { FC, ReactElement, ReactNode } from 'react'

export interface ChannelTab { channelId: string; guildId: string; label: string }
export interface Settings { tabs: ChannelTab[] }
interface Channel { id: string; guild_id?: string | null; name?: string; rawRecipients?: Array<{ username?: string; global_name?: string; display_name?: string }> }
interface ChannelSheetProps { channel: Channel; [key: string]: unknown }
type ChannelSheet = FC<ChannelSheetProps>
interface TransitionModule { transitionToGuild(guildId: string, channelId?: string): void }

const DEFAULTS: Settings = { tabs: [] }
const { ActionSheet, ActionSheetRow, Text } = Design
let storage: any
let transition: TransitionModule['transitionToGuild'] | undefined

function getTransition() {
  if (transition) return transition
  transition = getModules(withProps<TransitionModule>('transitionToGuild'))[0]?.transitionToGuild
  return transition
}
function openChannel(tab: ChannelTab) {
  getTransition()?.(tab.guildId || '@me', tab.channelId)
}
function makeTab(channel: Channel): ChannelTab {
  const recipient = channel.rawRecipients?.[0]
  const label = channel.name || recipient?.display_name || recipient?.global_name || recipient?.username || (channel.guild_id ? 'Channel' : 'DM')
  return { channelId: channel.id, guildId: channel.guild_id ?? '@me', label: label.startsWith('#') ? label : channel.guild_id ? `#${label}` : label }
}
function saveTab(channel: Channel) {
  if (!storage) return
  const tab = makeTab(channel)
  const tabs = (storage.cache?.tabs ?? []) as ChannelTab[]
  storage.set({ tabs: [...tabs.filter(x => x.channelId !== tab.channelId), tab] })
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
function addPinAction(tree: unknown, channel: Channel) {
  const sheet = findActionSheet(tree)
  if (!sheet) return
  const group = createElement(ActionSheetRow.Group, null,
    createElement(ActionSheetRow, { label: 'Add to Channel Tabs', onPress: () => saveTab(channel) }),
  )
  const children = [sheet.props.children].flat().filter(Boolean)
  children.splice(Math.max(children.length - 1, 0), 0, group)
  sheet.props.children = children
}

function TabsBar() {
  const tabs = ((storage?.use() as Settings | undefined)?.tabs ?? []) as ChannelTab[]
  if (!tabs.length) return null
  const selectedId = (Stores.SelectedChannelStore as any).getChannelId?.()
  return createElement(ScrollView, {
    horizontal: true,
    showsHorizontalScrollIndicator: false,
    keyboardShouldPersistTaps: 'always',
    contentContainerStyle: { paddingHorizontal: 8, paddingVertical: 6, gap: 7 },
    style: { maxHeight: 48, backgroundColor: '#202127' },
  }, tabs.map(tab => createElement(Pressable, {
    key: tab.channelId,
    onPress: () => openChannel(tab),
    onLongPress: () => ActionSheetActionCreators.openLazy(
      Promise.resolve({ default: () => createElement(TabActions, { tab }) }),
      `CHANNEL_TAB_ACTIONS_${tab.channelId}`,
    ),
    style: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: selectedId === tab.channelId ? '#5865f2' : '#313338',
      justifyContent: 'center',
    },
  }, createElement(Text, { color: 'text-normal', variant: 'text-sm/medium', numberOfLines: 1 }, tab.label))))
}
function TabActions({ tab }: { tab: ChannelTab }) {
  return createElement(ActionSheet, null,
    createElement(ActionSheetRow.Group, null,
      createElement(ActionSheetRow, { label: `Open ${tab.label}`, onPress: () => openChannel(tab) }),
      createElement(ActionSheetRow, { label: 'Remove tab', variant: 'danger', onPress: () => storage?.set({ tabs: (storage.cache?.tabs ?? []).filter((x: ChannelTab) => x.channelId !== tab.channelId) }) }),
    ),
  )
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    storage = jsonStorage
    const patchSheet = (name: string) => getModules(withName<ChannelSheet>(name), module => {
      cleanup(instead(module, 'default', (args, original) => {
        const tree = original.apply(undefined, args)
        const channel = (args[0] as ChannelSheetProps | undefined)?.channel
        if (channel?.id) {
          try { addPinAction(tree, channel) }
          catch (error) { plugin.reportError(`Could not add tab action: ${String(error)}`) }
        }
        return tree
      }))
    }, { returnNamespace: true })
    cleanup(
      patchSheet('ChannelLongPressActionSheet'),
      patchSheet('DMChannelLongPressActionSheet'),
      getModules(withName<FC>('ChannelHeader'), module => {
        const Component = module.default as any
        const injectTabs = (tree: ReactNode) => {
          if (!isValidElement(tree)) return tree
          return createElement(View, { style: { width: '100%' } }, tree, createElement(TabsBar))
        }
        if (typeof Component === 'function') cleanup(after(module, 'default', injectTabs))
        else if (typeof Component?.type === 'function') cleanup(after(Component, 'type', injectTabs))
      }, { returnNamespace: true }),
    )
  },
  stop() { storage = undefined; transition = undefined },
  SettingsComponent,
})
