import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ConnectionProvider } from '../hooks/useConnection'

export default function RootLayout() {
  return (
    <ConnectionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ConnectionProvider>
  )
}
