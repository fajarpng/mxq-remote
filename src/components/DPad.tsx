import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { RemoteButton } from './RemoteButton'
import type { KeyName } from '../constants/keyEvents'

export function DPad({ press }: { press: (key: KeyName) => () => void }) {
  const { width } = useWindowDimensions()
  const pad = Math.min(width - 48, 300)
  const size = pad / 3 - 8
  const arrow = { width: size, height: size, borderRadius: 20 }

  return (
    <View style={[styles.pad, { width: pad, height: pad, borderRadius: pad / 2 }]}>
      <RemoteButton label="Up" glyph="▲" onPress={press('DPAD_UP')} style={arrow} />
      <View style={styles.row}>
        <RemoteButton label="Left" glyph="◀" onPress={press('DPAD_LEFT')} style={arrow} />
        <RemoteButton label="OK" glyph="OK" onPress={press('DPAD_CENTER')} style={[arrow, styles.ok, { borderRadius: size / 2 }]} />
        <RemoteButton label="Right" glyph="▶" onPress={press('DPAD_RIGHT')} style={arrow} />
      </View>
      <RemoteButton label="Down" glyph="▼" onPress={press('DPAD_DOWN')} style={arrow} />
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  ok: { backgroundColor: '#2563eb' },
})
