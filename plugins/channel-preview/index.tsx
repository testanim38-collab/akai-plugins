import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { after, instead } from '@valenced/patcher'
import { Fragment, createElement, isValidElement, useEffect } from 'react'
import { Dimensions } from 'react-native'
import { HostMount, hostState } from './overlay'
import SettingsComponent from './settings'
import { insertGroup, isChannelSheetKey, navigate, resetNavigation, toast } from './sheet'
import { closeAll, closeWindow, openWindow } from './store'
import type { FC, ReactElement, ReactNode } from 'react'

export type PreviewMode = 'preview' | 'menu'
export interface Settings {
  mode: PreviewMode
  debug: boolean
  hostName: string
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

const DEFAULTS: Settings = { mode: 'preview', debug: false, hostName: '' }
// Root-level components that stay mounted while the app is open. The first one that
// renders claims the overlay; the others render nothing. Override via settings.
const HOST_CANDIDATES = ['AppContainer', 'App', 'RootNavigator', 'MainNavigator', 'ChatScreen']
const { ActionSheetRow } = Design

function openPreview(channel: Channel) {
  openWindow(
    { id: channel.id, guildId: channel.guild_id ?? '@me', name: channel.name ?? '' },
    Dimensions.get('window'),
  )
}

export default plugin<{ jsonStorage: Settings }>({
  jsonStorage: { load: true, default: DEFAULTS },
  start({ cleanup, jsonStorage, plugin }) {
    const settings = (): Settings => ({ ...DEFAULTS, ...(jsonStorage.cache ?? {}) })
    const mode = () => settings().mode
    const debug = () => settings().debug

    hostState.onOpenFull = win => {
      closeWindow(win.id)
      if (!navigate(win.guildId, win.id)) toast('Could not open the channel')
    }

    const hideSheet = (props: ChannelActionSheetProps) => {
      if (typeof props.onClose === 'function') props.onClose()
      else ActionSheetActionCreators.hideActionSheet()
    }

    // Preview mode: intercept before the sheet opens, so there is never a sheet to
    // close. (Closing it from inside its own render left an invisible layer that
    // swallowed every touch.)
    cleanup(
      getModules(withProps<any>('openLazy', 'hideActionSheet'), module => {
        cleanup(
          instead(module as any, 'openLazy', ((args: any[], original: (...a: any[]) => unknown) => {
            const [, key, props] = args
            if (mode() === 'preview' && isChannelSheetKey(key, props)) {
              if (debug()) toast(`Preview: intercepted ${String(key)}`)
              openPreview(props.channel)
              return undefined
            }
            return original(...args)
          }) as any),
        )
      }),
    )

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

                if (mode() === 'preview') {
                  // Fallback if the openLazy hook above did not catch this sheet:
                  // let the sheet finish opening, then close it and show the popup.
                  return createElement(function ChannelPreviewLauncher() {
                    useEffect(() => {
                      setTimeout(() => hideSheet(props), 60)
                      setTimeout(() => openPreview(channel), 350)
                    }, [])
                    return null
                  })
                }

                const Wrapped: ChannelActionSheet = innerProps => {
                  const innerTree = (Inner as ChannelActionSheet)(innerProps) as ReactNode
                  const group = createElement(
                    ActionSheetRow.Group as any,
                    { key: 'akai-channel-preview' },
                    createElement(ActionSheetRow, {
                      label: 'Preview channel',
                      onPress: () => {
                        hideSheet(props)
                        setTimeout(() => openPreview(channel), 300)
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
    )

    // Mount the floating-window host on a root component.
    const names = [settings().hostName.trim(), ...HOST_CANDIDATES].filter(Boolean)
    for (const name of names) {
      cleanup(
        getModules(
          withName<FC>(name),
          module => {
            const holder = module as any
            const inject = (tree: ReactNode) =>
              createElement(
                Fragment,
                null,
                tree as ReactNode,
                createElement(HostMount, {
                  key: 'akai-preview-host',
                  label: name,
                  onMounted: label => debug() && toast(`Preview host: ${label}`),
                }),
              )
            if (typeof holder?.default === 'function') cleanup(after(holder, 'default', inject as any))
            else if (typeof holder?.default?.type === 'function') cleanup(after(holder.default, 'type', inject as any))
            else if (typeof holder?.type === 'function') cleanup(after(holder, 'type', inject as any))
          },
          { returnNamespace: true },
        ),
      )
    }
  },
  stop() {
    closeAll()
    resetNavigation()
  },
  SettingsComponent,
})
