import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
import { RemoteButton } from './RemoteButton'
import type { KeyName } from '../constants/keyEvents'

type Props = {
  sendText: (text: string) => Promise<void>
  press: (key: KeyName) => () => void
  onError: (message: string) => void
}

export function KeyboardInput({ sendText, press, onError }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!text || sending) return
    setSending(true)
    try {
      await sendText(text)
      setText('') // only cleared once the box accepted it, so a failure keeps the text for retry
    } catch (err) {
      onError(`Text not sent: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Select a text field on the TV first, then type here.</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder="Type text for the TV"
        returnKeyType="send"
        submitBehavior="submit"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus
        accessibilityLabel="Text to send"
      />
      <View style={styles.row}>
        <RemoteButton label="Delete" glyph="⌫" onPress={press('DEL')} style={styles.key} />
        <RemoteButton
          label="Send text"
          glyph={sending ? '…' : 'Send'}
          onPress={submit}
          style={[styles.key, styles.send, (!text || sending) && styles.disabled]}
        />
        <RemoteButton label="Enter" glyph="⏎" onPress={press('NUMPAD_ENTER')} style={styles.key} />
      </View>
      {sending && <ActivityIndicator />}
      <Text style={styles.note}>Plain English letters, numbers and symbols only. Sending takes a few seconds on this box.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 14 },
  hint: { color: '#374151', fontSize: 15, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 14, fontSize: 18, backgroundColor: '#fff', color: '#111827' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  key: { width: 80, height: 60 },
  send: { width: 120, backgroundColor: '#2563eb' },
  disabled: { opacity: 0.5 },
  note: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
})
