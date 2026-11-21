import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { after } from '@valenced/patcher'
import { createElement, isValidElement } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
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
  wrapSheet,
} from './sheet'
import type { FC, ReactNode } from 'react'

export interface ChannelTab {
  channelId: string
  guildId: string
  label: string
}
export interface Settings {
  tabs: ChannelTab[]
  debug: boolean
}
interface Channel {
  id: string
  guild_id?: string | null
  name?: string
  rawRecipients?: Array<{ username?: string; global_name?: string; display_name?: string }>
}

const DEFAULTS: Settings = { tabs: [], debug: false }
const { ActionSheet, ActionSheetRow, Text } = Design
let storage: any

export function makeTab(channel: Channel): ChannelTab {
  const recipient = channel.rawRecipients?.[0]
  const label =
    channel.name ||
    recipient?.display_name ||
    recipient?.global_name ||
    recipient?.username ||
    (channel.guild_id ? 'Channel' : 'DM')
  return {
    channelId: channel.id,
    guildId: channel.guild_id ?? '@me',
    label: label.startsWith('#') ? label : channel.guild_id ? `#${label}` : label,
  }
}

export function currentChannel(): Channel | undefined {
  const id = (Stores.SelectedChannelStore as any)?.getChannelId?.()
  return id ? (Stores.ChannelStore as any)?.getChannel?.(id) : undefined
}

export function readTabs(): ChannelTab[] {
  return (storage?.cache?.tabs ?? []) as ChannelTab[]
}

export function addTab(channel: Channel) {
  if (!storage || !channel?.id) return false
  const tab = makeTab(channel)
  storage.set({ tabs: [...readTabs().filter(x => x.channelId !== tab.channelId), tab] })
  return true
}

export function removeTab(channelId: string) {
  storage?.set({ tabs: readTabs().filter(x => x.channelId !== channelId) })
}

function openTab(tab: ChannelTab) {
  if (!navigate(tab.guildId || '@me', tab.channelId)) toast('Could not open this tab')
}

function TabChip({ label, active, onPress, onLongPress }: { label: string; active?: boolean; onPress: () => void; onLongPress?: () => void }) {
  return createElement(
    Pressable,
    {
      onPress,
      onLongPress,
      style: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
        backgroundColor: active ? '#5865f2' : '#313338',
        justifyContent: 'center',
      },
    },
    createElement(Text, { color: 'text-normal', variant: 'text-sm/medium', numberOfLines: 1 }, label),
  )
}

function TabsBar() {
  const tabs = ((storage?.use() as Settings | undefined)?.tabs ?? []) as ChannelTab[]
  const channel = currentChannel()
  const selectedId = channel?.id
  const canAdd = !!channel && !tabs.some(x => x.channelId === selectedId)
  if (!tabs.length && !canAdd) return null
  return createElement(
    ScrollView,
    {
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      keyboardShouldPersistTaps: 'always',
      contentContainerStyle: { paddingHorizontal: 8, paddingVertical: 6, gap: 7 },
      style: { maxHeight: 48, backgroundColor: '#202127' },
    },
    ...tabs.map(tab =>
      createElement(TabChip, {
        key: tab.channelId,
        label: tab.label,
        active: selectedId === tab.channelId,
        onPress: () => openTab(tab),
        onLongPress: () =>
          openSheet(() => createElement(TabActions, { tab }), `CHANNEL_TAB_ACTIONS_${tab.channelId}`, {}),
      }),
    ),
    canAdd && channel
      ? createElement(TabChip, { key: 'add-current', label: '+ Pin this', onPress: () => addTab(channel) })
      : null,
  )
}

function TabActions({ tab }: { tab: ChannelTab }) {
  const close = () => ActionSheetActionCreators.hideActionSheet(`CHANNEL_TAB_ACTIONS_${tab.channelId}`)
  return createElement(
    ActionSheet,
    null,
    createElement(
      ActionSheetRow.Group,
      null,
      createElement(ActionSheetRow, {
        label: `Open ${tab.label}`,
        onPress: () => {
          close()
          openTab(tab)
        },
      }),
      createElement(ActionSheetRow, {
        label: 'Remove tab',
        variant: 'danger',
        onPress: () => {
          close()
          removeTab(tab.channelId)
        },
      }),
    ),
  )
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    storage = jsonStorage
    const debug = () => !!jsonStorage.cache?.debug

    patchOpenLazy(({ key, props, component }) => {
      const channel = channelOf(props)
      if (debug() && channel) {
        toast(`tabs: ${key} / ${sheetName(component) || 'unnamed'} / ${isChannelSheet(key, props, component) ? 'match' : 'skip'}`)
      }
      if (!isChannelSheet(key, props, component)) return undefined
      return wrapSheet(component, tree => {
        try {
          const target = props.channel as Channel
          const pinned = readTabs().some(x => x.channelId === target.id)
          const group = createElement(
            ActionSheetRow.Group as any,
            { key: 'akai-channel-tabs' },
            createElement(ActionSheetRow, {
              label: pinned ? 'Remove from Channel Tabs' : 'Add to Channel Tabs',
              onPress: () => {
                ActionSheetActionCreators.hideActionSheet(key)
                if (pinned) removeTab(target.id)
                else addTab(target)
                toast(pinned ? 'Removed from Channel Tabs' : 'Added to Channel Tabs')
              },
            }),
          )
          const result = insertGroup(tree, group)
          if (!result.ok && debug()) toast('tabs: could not find where to insert the row')
          return result.tree
        } catch (error) {
          plugin.reportError(error)
          return tree
        }
      })
    }, cleanup)

    cleanup(
      getModules(
        withName<FC>('ChannelHeader'),
        module => {
          const holder = module as any
          const injectTabs = (tree: ReactNode) => {
            if (!isValidElement(tree)) return tree
            return createElement(View, { style: { width: '100%' } }, tree, createElement(TabsBar))
          }
          if (typeof holder?.default === 'function') cleanup(after(holder, 'default', injectTabs as any))
          else if (typeof holder?.default?.type === 'function') cleanup(after(holder.default, 'type', injectTabs as any))
          else if (typeof holder?.type === 'function') cleanup(after(holder, 'type', injectTabs as any))
        },
        { returnNamespace: true },
      ),
    )
  },
  stop() {
    storage = undefined
    resetNavigation()
  },
  SettingsComponent,
})
