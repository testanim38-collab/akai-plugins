import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native'
import PreviewChat from './chat'
import { MIN_H, MIN_W, closeWindow, focusWindow, getWindow, minimizeWindow, patchWindow, usePreviewWindows } from './store'
import type { PreviewWindow } from './store'

const BUBBLE = 48
const TOP_INSET = 48
export const hostState = { onOpenFull: (_w: PreviewWindow) => {} }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: '#dbdee1', fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  )
}

function Win({ win, screen }: { win: PreviewWindow; screen: { width: number; height: number } }) {
  const start = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const id = win.id
  const screenRef = useRef(screen)
  screenRef.current = screen

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const cur = getWindow(id)
          if (cur) start.current = { ...start.current, x: cur.x, y: cur.y }
          focusWindow(id)
        },
        onPanResponderMove: (_, g) => {
          const cur = getWindow(id)
          if (!cur) return
          const s = screenRef.current
          patchWindow(id, {
            x: clamp(start.current.x + g.dx, 0, s.width - cur.w),
            y: clamp(start.current.y + g.dy, TOP_INSET, s.height - 60),
          })
        },
      }),
    [id],
  )

  const resize = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const cur = getWindow(id)
          if (cur) start.current = { ...start.current, w: cur.w, h: cur.h }
          focusWindow(id)
        },
        onPanResponderMove: (_, g) => {
          const cur = getWindow(id)
          if (!cur) return
          const s = screenRef.current
          patchWindow(id, {
            w: clamp(start.current.w + g.dx, MIN_W, s.width - cur.x),
            h: clamp(start.current.h + g.dy, MIN_H, s.height - cur.y),
          })
        },
      }),
    [id],
  )

  return (
    <View
      style={{
        position: 'absolute',
        left: win.x,
        top: win.y,
        width: win.w,
        height: win.h,
        zIndex: win.z,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#313338',
        borderWidth: 1,
        borderColor: '#1e1f22',
        elevation: 12 + win.z,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 10,
      }}
    >
      <View {...drag.panHandlers} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1f22', paddingLeft: 12, paddingRight: 4, height: 38 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: '#f2f3f5', fontWeight: '700' }}>
          {win.name ? `#${win.name}` : 'Channel'}
        </Text>
        <Btn label="–" onPress={() => minimizeWindow(id, screenRef.current)} />
        <Btn label="⤢" onPress={() => hostState.onOpenFull(win)} />
        <Btn label="✕" onPress={() => closeWindow(id)} />
      </View>
      <View style={{ flex: 1 }}>
        <PreviewChat channelId={id} />
      </View>
      <View {...resize.panHandlers} style={{ height: 22, backgroundColor: '#1e1f22', alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 }}>
        <Text style={{ color: '#949ba4', fontSize: 12 }}>drag to resize ◢</Text>
      </View>
    </View>
  )
}

function Bubble({ win, screen }: { win: PreviewWindow; screen: { width: number; height: number } }) {
  const id = win.id
  const screenRef = useRef(screen)
  screenRef.current = screen
  const origin = useRef({ x: 0, y: 0 })
  const moved = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const cur = getWindow(id)
          if (cur) origin.current = { x: cur.bx, y: cur.by }
          moved.current = false
          timer.current = setTimeout(() => {
            if (!moved.current) closeWindow(id)
          }, 700)
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 8) {
            moved.current = true
            clearTimeout(timer.current)
          }
          if (!moved.current) return
          const s = screenRef.current
          patchWindow(id, {
            bx: clamp(origin.current.x + g.dx, 0, s.width - BUBBLE),
            by: clamp(origin.current.y + g.dy, TOP_INSET, s.height - BUBBLE - 20),
          })
        },
        onPanResponderRelease: () => {
          clearTimeout(timer.current)
          const cur = getWindow(id)
          if (!cur) return
          if (!moved.current) {
            patchWindow(id, { minimized: false })
            focusWindow(id)
            return
          }
          const s = screenRef.current
          // Snap to the nearest side edge.
          patchWindow(id, { bx: cur.bx + BUBBLE / 2 < s.width / 2 ? 6 : s.width - BUBBLE - 6 })
        },
        onPanResponderTerminate: () => clearTimeout(timer.current),
      }),
    [id],
  )

  return (
    <View
      {...pan.panHandlers}
      style={{
        position: 'absolute',
        left: win.bx,
        top: win.by,
        width: BUBBLE,
        height: BUBBLE,
        borderRadius: BUBBLE / 2,
        backgroundColor: '#5865f2',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        elevation: 40,
        borderWidth: 2,
        borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{(win.name?.[0] ?? '#').toUpperCase()}</Text>
    </View>
  )
}

// box-none: the host itself never takes touches, only the windows/bubbles on it.
export function PreviewHost() {
  const wins = usePreviewWindows()
  const screen = useWindowDimensions()
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 99999 }}>
      {wins.filter(w => !w.minimized).map(w => <Win key={w.id} win={w} screen={screen} />)}
      {wins.filter(w => w.minimized).map(w => <Bubble key={w.id} win={w} screen={screen} />)}
    </View>
  )
}

let claimed: symbol | undefined
export function HostMount({ label, onMounted }: { label: string; onMounted?: (label: string) => void }) {
  const me = useRef(Symbol('host')).current
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!claimed) {
      claimed = me
      setActive(true)
      onMounted?.(label)
    }
    return () => {
      if (claimed === me) claimed = undefined
    }
  }, [])
  return <Fragment>{active ? <PreviewHost /> : null}</Fragment>
}
