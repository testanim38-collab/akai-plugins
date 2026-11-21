import { useSyncExternalStore } from 'react'

export interface PreviewWindow {
  id: string // channel id
  guildId: string
  name: string
  minimized: boolean
  x: number
  y: number
  w: number
  h: number
  z: number
  bx: number
  by: number
}

export const MAX_PREVIEWS = 5
export const MIN_W = 240
export const MIN_H = 220

let windows: PreviewWindow[] = []
let zCounter = 1
const listeners = new Set<() => void>()

function commit(next: PreviewWindow[]) {
  windows = next
  for (const l of listeners) l()
}

export const getWindows = () => windows
export const getWindow = (id: string) => windows.find(w => w.id === id)

export function usePreviewWindows() {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => void listeners.delete(cb)
    },
    getWindows,
  )
}

export function openWindow(input: { id: string; guildId: string; name: string }, screen: { width: number; height: number }) {
  const existing = getWindow(input.id)
  if (existing) {
    patchWindow(input.id, { minimized: false, z: ++zCounter })
    return
  }
  const n = windows.length
  const w = Math.min(340, screen.width - 24)
  const h = Math.min(420, Math.round(screen.height * 0.55))
  const win: PreviewWindow = {
    ...input,
    minimized: false,
    x: Math.max(8, Math.round((screen.width - w) / 2)) + (n % 4) * 12,
    y: 70 + (n % 4) * 16,
    w,
    h,
    z: ++zCounter,
    bx: screen.width - 54,
    by: 120,
  }
  // Drop the oldest preview when over the limit.
  commit([...windows, win].slice(-MAX_PREVIEWS))
}

export function patchWindow(id: string, patch: Partial<PreviewWindow>) {
  commit(windows.map(w => (w.id === id ? { ...w, ...patch } : w)))
}

export function minimizeWindow(id: string, screen: { width: number; height: number }) {
  const slot = windows.filter(w => w.minimized).length
  patchWindow(id, { minimized: true, bx: screen.width - 54, by: Math.min(110 + slot * 58, screen.height - 120) })
}

export const focusWindow = (id: string) => patchWindow(id, { z: ++zCounter })
export const closeWindow = (id: string) => commit(windows.filter(w => w.id !== id))
export const closeAll = () => commit([])
