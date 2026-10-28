import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Redirect } from 'expo-router'
import { useConnection } from '../hooks/useConnection'
import { ConnectionStatus } from '../components/ConnectionStatus'

export default function ConnectionScreen() {
  const { status, error, host, port, connect, disconnect } = useConnection()
  const [hostInput, setHostInput] = useState(host)
  const [portInput, setPortInput] = useState(port)
  const busy = status === 'connecting' || status === 'reconnecting' || status === 'loading'

  // Show restored/last-used values once they load.
  useEffect(() => setHostInput(host), [host])
  useEffect(() => setPortInput(port), [port])

  if (status === 'connected' || status === 'reconnecting') return <Redirect href="/remote" />

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <Text style={styles.icon} accessibilityElementsHidden>▣</Text>
        <Text style={styles.title}>MXQ Remote</Text>
        <Text style={styles.hint}>
          Your phone and TV box must be on the same Wi-Fi network, with ADB over network enabled on the box.
        </Text>

        <Text style={styles.label}>TV box IP address</Text>
        <TextInput
          style={styles.input}
          value={hostInput}
          onChangeText={setHostInput}
          keyboardType="decimal-pad"
          editable={!busy}
          placeholder="192.168.1.8"
          accessibilityLabel="TV box IP address"
        />
        <Text style={styles.label}>ADB port</Text>
        <TextInput
          style={styles.input}
          value={portInput}
          onChangeText={setPortInput}
          keyboardType="number-pad"
          editable={!busy}
          placeholder="5555"
          accessibilityLabel="ADB port"
        />

        <View style={styles.statusRow}>
          <ConnectionStatus status={status} />
          {busy && <ActivityIndicator />}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}

        {busy ? (
          <Pressable style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]} onPress={disconnect}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => connect(hostInput, portInput)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{status === 'error' ? 'Retry' : 'Connect'}</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  icon: { fontSize: 56, textAlign: 'center', color: '#111827' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: '#111827' },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 14, fontSize: 18,
    backgroundColor: '#fff', marginBottom: 16, color: '#111827',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  button: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondary: { backgroundColor: '#e5e7eb' },
  secondaryText: { color: '#111827' },
})
