import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'

type Props = {
  label: string
  glyph: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

export function RemoteButton({ label, glyph, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderRadius: 18, minWidth: 64, minHeight: 64 },
  pressed: { backgroundColor: '#4b5563', transform: [{ scale: 0.95 }] },
  glyph: { color: '#fff', fontSize: 26, fontWeight: '500' },
})
