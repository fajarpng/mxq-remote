import { StyleSheet, Text, View } from 'react-native'
import type { Status } from '../hooks/useConnection'

const LABELS: Record<Status, [string, string]> = {
  loading: ['Loading…', '#9ca3af'],
  idle: ['Not connected', '#9ca3af'],
  connecting: ['Connecting…', '#f59e0b'],
  reconnecting: ['Reconnecting…', '#f59e0b'],
  connected: ['Connected', '#16a34a'],
  error: ['Connection failed', '#dc2626'],
}

export function ConnectionStatus({ status, target }: { status: Status; target?: string }) {
  const [label, color] = LABELS[status]
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={`Status: ${label}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{target ? `${label} · ${target}` : label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: 15, color: '#374151' },
})
