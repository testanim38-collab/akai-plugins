import { ActionSheetActionCreators, ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { cloneElement, createElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

export interface SheetContext {
  key: string
  props: any
  component: any
  bypass: boolean
}
export type SheetFactory = (context: SheetContext) => unknown

interface TransitionModule {
  transitionToGuild(guildId: string, channelId?: string): unknown
}
interface PathModule {
  transitionTo(path: string): unknown
}
interface OpenLazyModule {
  openLazy: (...args: any[]) => unknown
  hideActionSheet: (key?: string) => void
}

const INCLUDE = /(channel|dm|thread).*(longpress|actions?|actionsheet|contextmenu|menu)|longpress.*(channel|dm)/i
const EXCLUDE = /message|reaction|notification|setting|invite|permission|create|emoji|sticker|profile|member/i

let guildTransition: TransitionModule | undefined
let pathTransition: PathModule | undefined
let bypassNext = false

export function navigate(guildId: string, channelId?: string) {
  if (!guildTransition) {
    const [found] = lookupModule(withProps<TransitionModule>('transitionToGuild')) as unknown as [TransitionModule?]
    guildTransition = found
  }
  if (guildTransition) {
    guildTransition.transitionToGuild(guildId, channelId)
    return true
  }
  if (!pathTransition) {
    const [found] = lookupModule(withProps<PathModule>('transitionTo')) as unknown as [PathModule?]
    pathTransition = found
  }
  if (pathTransition) {
    pathTransition.transitionTo(channelId ? `/channels/${guildId}/${channelId}` : `/channels/${guildId}`)
    return true
  }
  return false
}

export function resetNavigation() {
  guildTransition = undefined
  pathTransition = undefined
}

export function toast(text: string) {
  try {
    ToastActionCreators.open('AKAI_PLUGIN_TOAST', { text })
  } catch {}
}

export function withBypass<T>(run: () => T): T {
  bypassNext = true
  try {
    return run()
  } finally {
    bypassNext = false
  }
}

export function sheetName(component: any, depth = 0): string {
  if (!component || depth > 4) return ''
  if (typeof component === 'function') return component.displayName || component.name || ''
  return component.displayName || sheetName(component.type, depth + 1) || sheetName(component.render, depth + 1)
}

export function channelOf(props: any) {
  const channel = props?.channel
  return channel && typeof channel === 'object' && channel.id ? channel : undefined
}

export function isChannelSheet(key: string, props: any, component: any) {
  if (!channelOf(props) || props?.message) return false
  const label = `${key} ${sheetName(component)}`
  return INCLUDE.test(label) && !EXCLUDE.test(label)
}

function renderComponent(component: any, props: any, depth = 0): ReactNode {
  if (typeof component === 'function') {
    if (component.prototype?.isReactComponent) return createElement(component, props)
    return component(props)
  }
  if (component && depth < 4) {
    if (typeof component.render === 'function') return component.render(props, null)
    if (component.type) return renderComponent(component.type, props, depth + 1)
  }
  return createElement(component, props)
}

export function wrapSheet(component: any, transform: (tree: ReactNode, props: any) => ReactNode) {
  const Wrapped = (props: any) => transform(renderComponent(component, props), props)
  Wrapped.displayName = sheetName(component) || 'WrappedSheet'
  return Wrapped
}

function childrenOf(node: ReactElement): ReactNode[] {
  const children = (node.props as { children?: ReactNode }).children
  if (children === undefined || children === null) return []
  return Array.isArray(children) ? (children as ReactNode[]).flat(Infinity as 1) : [children]
}

function isRowLike(node: unknown) {
  if (!isValidElement(node)) return false
  const { ActionSheetRow, TableRowGroup, TableRow } = Design
  return node.type === ActionSheetRow.Group || node.type === TableRowGroup || node.type === ActionSheetRow || node.type === TableRow
}

function place(node: ReactNode, group: ReactElement): { node: ReactNode; done: boolean } {
  if (Array.isArray(node)) {
    let done = false
    const next = node.map(child => {
      if (done) return child
      const result = place(child, group)
      done = result.done
      return result.node
    })
    return { node: done ? next : node, done }
  }
  if (!isValidElement(node)) return { node, done: false }
  const children = childrenOf(node)
  const index = children.findIndex(isRowLike)
  if (index >= 0) {
    const next = [...children]
    next.splice(index + 1, 0, group)
    return { node: cloneElement(node, undefined, ...next), done: true }
  }
  let done = false
  const next = children.map(child => {
    if (done) return child
    const result = place(child, group)
    done = result.done
    return result.node
  })
  return done ? { node: cloneElement(node, undefined, ...next), done: true } : { node, done: false }
}

function append(node: ReactNode, group: ReactElement): { node: ReactNode; done: boolean } {
  if (Array.isArray(node)) {
    let done = false
    const next = node.map(child => {
      if (done) return child
      const result = append(child, group)
      done = result.done
      return result.node
    })
    return { node: done ? next : node, done }
  }
  if (!isValidElement(node)) return { node, done: false }
  if (node.type === Design.ActionSheet) {
    return { node: cloneElement(node, undefined, ...childrenOf(node), group), done: true }
  }
  let done = false
  const next = childrenOf(node).map(child => {
    if (done) return child
    const result = append(child, group)
    done = result.done
    return result.node
  })
  return done ? { node: cloneElement(node, undefined, ...next), done: true } : { node, done: false }
}

export function insertGroup(tree: ReactNode, group: ReactElement): { tree: ReactNode; ok: boolean } {
  const placed = place(tree, group)
  if (placed.done) return { tree: placed.node, ok: true }
  const appended = append(tree, group)
  return { tree: appended.done ? appended.node : tree, ok: appended.done }
}

export function openSheet(component: any, key: string, props: any) {
  ActionSheetActionCreators.openLazy(Promise.resolve({ default: component }), key, props)
}

export function patchOpenLazy(factory: SheetFactory, cleanup: (...fns: Array<() => unknown>) => void) {
  const patched = new WeakSet<object>()
  cleanup(
    getModules(withProps<OpenLazyModule>('openLazy', 'hideActionSheet'), module => {
      const target = module as unknown as Record<string, any>
      if (patched.has(target)) return
      patched.add(target)
      cleanup(
        instead(target as any, 'openLazy', ((args: any[], original: (...a: any[]) => unknown) => {
          const [sheet, key, props, stacking] = args
          const bypass = bypassNext
          const next = Promise.resolve(sheet).then((loaded: any) => {
            const component = loaded?.default
            if (!component) return loaded
            try {
              const replacement = factory({ key: String(key), props, component, bypass })
              return replacement ? { ...loaded, default: replacement } : loaded
            } catch {
              return loaded
            }
          })
          return original(next, key, props, stacking)
        }) as any),
      )
    }),
  )
}

// Decide from the openLazy key + props alone (before the lazy sheet loads), so
// preview mode can skip opening the sheet at all instead of opening and closing it.
export function isChannelSheetKey(key: unknown, props: any) {
  if (!channelOf(props) || props?.message) return false
  const label = String(key ?? '')
  return /channel/i.test(label) && /(longpress|actionsheet|actions?|menu)/i.test(label) && !EXCLUDE.test(label)
}
