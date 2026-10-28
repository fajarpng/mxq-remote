import { useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import type { KeyName } from '../constants/keyEvents'

const SWIPE_MIN = 40 // px of travel before a swipe counts as navigation
const TAP_MAX = 10 // px of travel still treated as a tap
const TAP_MS = 300
const CURSOR_SPEED = 2 // phone px -> TV px
const CURSOR_FLUSH_MS = 30

type Props = {
  hasPointer: boolean
  sendKey: (key: KeyName) => void
  click: () => void
  movePointer: (dx: number, dy: number) => Promise<void>
  onError: (message: string) => void
}

export function Trackpad({ hasPointer, sendKey, click, movePointer, onError }: Props) {
  const [mode, setMode] = useState<'swipe' | 'cursor'>('swipe')
  const latest = useRef({ mode, sendKey, click, movePointer, onError })
  latest.current = { mode, sendKey, click, movePointer, onError }

  const responder = useMemo(() => {
    let start = 0
    let last = { x: 0, y: 0 }
    let pending = { x: 0, y: 0 }
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      timer = null
      const { x, y } = pending
      pending = { x: 0, y: 0 }
      if (x || y) latest.current.movePointer(x * CURSOR_SPEED, y * CURSOR_SPEED).catch(err => latest.current.onError(err.message))
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = Date.now()
        last = { x: 0, y: 0 }
      },
      onPanResponderMove: (_, g) => {
        if (latest.current.mode !== 'cursor') return
        pending.x += g.dx - last.x
        pending.y += g.dy - last.y
        last = { x: g.dx, y: g.dy }
        timer ??= setTimeout(flush, CURSOR_FLUSH_MS)
      },
      onPanResponderRelease: (_, g) => {
        const { mode, sendKey, click } = latest.current
        const dist = Math.max(Math.abs(g.dx), Math.abs(g.dy))
        const tap = dist < TAP_MAX && Date.now() - start < TAP_MS
        if (mode === 'cursor') {
          if (tap) click()
          return
        }
        // One gesture sends at most one key.
        if (tap) sendKey('DPAD_CENTER')
        else if (dist >= SWIPE_MIN)
          sendKey(Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 'DPAD_RIGHT' : 'DPAD_LEFT') : g.dy > 0 ? 'DPAD_DOWN' : 'DPAD_UP')
      },
    })
  }, [])

  return (
    <View style={styles.wrap}>
      {hasPointer && (
        <View style={styles.modes}>
          {(['swipe', 'cursor'] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.mode, mode === m && styles.modeActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m === 'swipe' ? 'Swipe' : 'Mouse cursor'}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.pad} {...responder.panHandlers} accessibilityLabel="Trackpad">
        <Text style={styles.hint}>
          {mode === 'swipe' ? 'Swipe to move · Tap to select' : 'Drag to move the cursor · Tap to click'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignSelf: 'stretch', gap: 12 },
  modes: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#e5e7eb', borderRadius: 10, padding: 3 },
  mode: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  modeActive: { backgroundColor: '#fff' },
  modeText: { color: '#6b7280', fontWeight: '600' },
  modeTextActive: { color: '#111827' },
  pad: { flex: 1, backgroundColor: '#1f2937', borderRadius: 20, alignItems: 'center', justifyContent: 'center', minHeight: 240 },
  hint: { color: '#9ca3af', fontSize: 15 },
})
