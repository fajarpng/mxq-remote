import { useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Redirect } from 'expo-router'
import { useConnection } from '../hooks/useConnection'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { RemoteButton } from '../components/RemoteButton'
import { DPad } from '../components/DPad'
import { Trackpad } from '../components/Trackpad'
import { KeyboardInput } from '../components/KeyboardInput'
import type { KeyName } from '../constants/keyEvents'

const MODES = [
  ['dpad', 'D-pad'],
  ['trackpad', 'Trackpad'],
  ['keyboard', 'Keyboard'],
] as const
type Mode = (typeof MODES)[number][0]

export default function RemoteScreen() {
  const { status, error, host, port, hasPointer, sendKey, sendText, click, movePointer, disconnect } = useConnection()
  const [mode, setMode] = useState<Mode>('dpad')
  const [failure, setFailure] = useState<string | null>(null)

  if (status !== 'connected' && status !== 'reconnecting') return <Redirect href="/" />

  const report = (err: Error) => setFailure(`Command failed: ${err.message}`)
  const press = (key: KeyName) => () => {
    setFailure(null)
    sendKey(key).catch(report)
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <ConnectionStatus status={status} target={`${host}:${port}`} />
        <Pressable onPress={disconnect} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.link}>Connection settings</Text>
        </Pressable>
      </View>
      {status === 'reconnecting' && <Text style={styles.banner}>{error ?? 'Reconnecting…'}</Text>}

      <View style={styles.tabs} accessibilityRole="tablist">
        {MODES.map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setMode(id)}
            style={[styles.tab, mode === id && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === id }}
          >
            <Text style={[styles.tabText, mode === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" scrollEnabled={mode !== 'trackpad'}>
          {mode === 'dpad' && <DPad press={press} />}
          {mode === 'trackpad' && (
            <Trackpad
              hasPointer={hasPointer}
              sendKey={key => press(key)()}
              click={() => click().catch(report)}
              movePointer={movePointer}
              onError={setFailure}
            />
          )}
          {mode === 'keyboard' && <KeyboardInput sendText={sendText} press={press} onError={setFailure} />}
          {failure && <Text style={styles.error}>{failure}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <RemoteButton label="Back" glyph="↩" onPress={press('BACK')} style={styles.key} />
          <RemoteButton label="Home" glyph="⌂" onPress={press('HOME')} style={styles.key} />
          <RemoteButton label="Menu" glyph="≡" onPress={press('MENU')} style={styles.key} />
          <RemoteButton label="Volume down" glyph="−" onPress={press('VOLUME_DOWN')} style={styles.key} />
          <RemoteButton label="Volume up" glyph="+" onPress={press('VOLUME_UP')} style={styles.key} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  link: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  banner: { backgroundColor: '#fef3c7', color: '#92400e', padding: 10, textAlign: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#6b7280', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: '#111827' },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 },
  error: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 8, paddingVertical: 12 },
  key: { width: 60, height: 56, minWidth: 0 },
})
