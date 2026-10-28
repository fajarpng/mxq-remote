import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import TcpSocket from 'react-native-tcp-socket'
import { RemoteController } from '../services/remoteController'
import type { CreateConnection } from '../services/adbClient'
import type { KeyName } from '../constants/keyEvents'

const STORAGE_KEY = 'mxq-remote/last-connection'
const RECONNECT_TRIES = 3
const RECONNECT_DELAY = 1500
export const DEFAULT_HOST = '192.168.1.8'
export const DEFAULT_PORT = '5555'

export type Status = 'loading' | 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'error'

export function validateTarget(host: string, port: string) {
  const octets = host.trim().split('.')
  const validHost = octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o) && Number(o) <= 255)
  if (!validHost) return 'Enter a valid IPv4 address, like 192.168.1.8.'
  if (!/^\d+$/.test(port.trim()) || Number(port) < 1 || Number(port) > 65535) return 'Port must be a whole number from 1 to 65535.'
  return null
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

function useConnectionState() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [host, setHost] = useState(DEFAULT_HOST)
  const [port, setPort] = useState(DEFAULT_PORT)
  const [hasPointer, setHasPointer] = useState(false)
  const controller = useRef<RemoteController | null>(null)
  const target = useRef<{ host: string; port: string } | null>(null)
  const attempt = useRef(0)
  const queue = useRef(Promise.resolve())
  const pending = useRef(0)

  const drop = () => {
    controller.current?.close()
    controller.current = null
  }

  // One attempt to reach `target`; resolves false if superseded by a newer connect/disconnect.
  const open = useCallback(async (id: number) => {
    const { host: h, port: p } = target.current!
    const remote = await RemoteController.connect(TcpSocket.createConnection as unknown as CreateConnection, h, Number(p))
    if (id !== attempt.current) {
      remote.close()
      return false
    }
    controller.current = remote
    setHasPointer(remote.hasPointer)
    setError(null)
    setStatus('connected')
    remote.onClose(err => {
      if (controller.current !== remote) return
      controller.current = null
      console.warn('connection lost', err.message)
      if (AppState.currentState === 'active') reconnect(err.message)
    })
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ host: h, port: p })).catch(err =>
      console.warn('could not save connection', err),
    )
    return true
  }, [])

  const reconnect = useCallback(
    async (reason: string) => {
      if (!target.current) return
      const id = ++attempt.current
      drop()
      setStatus('reconnecting')
      setError(reason)
      let last = reason
      for (let i = 0; i < RECONNECT_TRIES; i++) {
        try {
          if (await open(id)) return
        } catch (err) {
          last = message(err)
        }
        if (id !== attempt.current) return
        await sleep(RECONNECT_DELAY)
        if (id !== attempt.current) return
      }
      setError(`Could not reconnect: ${last}`)
      setStatus('error')
    },
    [open],
  )

  const connect = useCallback(
    async (h: string, p: string) => {
      const invalid = validateTarget(h, p)
      if (invalid) {
        setError(invalid)
        setStatus('error')
        return
      }
      const id = ++attempt.current
      drop()
      target.current = { host: h.trim(), port: p.trim() }
      setHost(h.trim())
      setPort(p.trim())
      setError(null)
      setStatus('connecting')
      try {
        await open(id)
      } catch (err) {
        if (id !== attempt.current) return
        console.warn('connect failed', err)
        setError(message(err))
        setStatus('error')
      }
    },
    [open],
  )

  const disconnect = useCallback(() => {
    attempt.current++
    target.current = null
    drop()
    setError(null)
    setStatus('idle')
  }, [])

  // Commands run one at a time so rapid taps arrive in order and never overlap.
  // Taps beyond a short backlog are dropped so a burst can't keep the TV moving after you stop.
  const run = useCallback((command: (remote: RemoteController) => Promise<void>) => {
    if (pending.current >= 3) return Promise.resolve()
    pending.current++
    const job = queue.current
      .then(() => {
        if (!controller.current) throw new Error('Not connected to the TV box.')
        return command(controller.current)
      })
      .finally(() => pending.current--)
    queue.current = job.catch(() => {})
    return job
  }, [])

  const sendKey = useCallback((key: KeyName) => run(remote => remote.key(key)), [run])
  const sendText = useCallback((text: string) => run(remote => remote.text(text)), [run])
  const click = useCallback(() => run(remote => remote.click()), [run])
  // Pointer moves skip the queue: they stream continuously and the latest position matters, not order with keys.
  const movePointer = useCallback(async (dx: number, dy: number) => {
    if (!controller.current) throw new Error('Not connected to the TV box.')
    await controller.current.movePointer(dx, dy)
  }, [])

  // Restore the last box on launch.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (!saved) return setStatus('idle')
        const { host: h, port: p } = JSON.parse(saved)
        connect(h, p)
      })
      .catch(err => {
        console.warn('could not read saved connection', err)
        setStatus('idle')
      })
    return () => drop()
  }, [connect])

  // The box accepts only one ADB client, so release it while the app is in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && controller.current) {
        attempt.current++
        drop()
        setStatus('reconnecting')
      } else if (state === 'active' && target.current && !controller.current) reconnect('Reconnecting…')
    })
    return () => sub.remove()
  }, [reconnect])

  return { status, error, host, port, hasPointer, connect, disconnect, sendKey, sendText, click, movePointer }
}

const ConnectionContext = createContext<ReturnType<typeof useConnectionState> | null>(null)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  return <ConnectionContext.Provider value={useConnectionState()}>{children}</ConnectionContext.Provider>
}

export function useConnection() {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used inside ConnectionProvider')
  return ctx
}
