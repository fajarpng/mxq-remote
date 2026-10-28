// Minimal ADB wire protocol client (CNXN / OPEN / WRTE / OKAY / CLSE) over a raw TCP socket.
// Spec: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/protocol.txt
// Transport-agnostic: works with Node `net.createConnection` and `react-native-tcp-socket`.

export type AdbErrorCode =
  | 'timeout'
  | 'refused'
  | 'unreachable'
  | 'auth'
  | 'closed'
  | 'protocol'

export class AdbError extends Error {
  code: AdbErrorCode

  constructor(code: AdbErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AdbError'
  }
}

export type Socket = {
  write(data: Uint8Array): unknown
  destroy(): void
  on(event: 'connect' | 'close', cb: () => void): unknown
  on(event: 'data', cb: (data: Uint8Array) => void): unknown
  on(event: 'error', cb: (err: Error & { code?: string }) => void): unknown
}

export type CreateConnection = (opts: { host: string; port: number }) => Socket

const A_CNXN = 0x4e584e43
const A_AUTH = 0x48545541
const A_OPEN = 0x4e45504f
const A_OKAY = 0x59414b4f
const A_CLSE = 0x45534c43
const A_WRTE = 0x45545257
const A_VERSION = 0x01000000
const MAX_PAYLOAD = 4096

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function packet(command: number, arg0: number, arg1: number, data: Uint8Array = new Uint8Array(0)) {
  const out = new Uint8Array(24 + data.length)
  const view = new DataView(out.buffer)
  let checksum = 0
  for (const b of data) checksum += b
  view.setUint32(0, command, true)
  view.setUint32(4, arg0, true)
  view.setUint32(8, arg1, true)
  view.setUint32(12, data.length, true)
  view.setUint32(16, checksum >>> 0, true)
  view.setUint32(20, (command ^ 0xffffffff) >>> 0, true)
  out.set(data, 24)
  return out
}

function socketError(err: Error & { code?: string }) {
  if (err.code === 'ECONNREFUSED')
    return new AdbError('refused', 'Connection refused. ADB over network may be disabled on the TV box, or the port is wrong.')
  if (err.code === 'ETIMEDOUT')
    return new AdbError('timeout', 'Connection timed out. Check the IP address and that the box is on.')
  return new AdbError('unreachable', `TV box unreachable (${err.code ?? err.message}). Check the IP address and Wi-Fi.`)
}

type Stream = {
  remoteId: number
  chunks: string[]
  resolve: (out: string) => void
  reject: (err: AdbError) => void
  timer: ReturnType<typeof setTimeout>
  // Persistent streams: ADB allows one unacknowledged WRTE, so further writes wait in the outbox.
  persistent?: boolean
  ready?: boolean
  outbox?: Uint8Array[]
  onOpen?: () => void
}

export type ShellStream = {
  write(text: string): void
  readonly isOpen: boolean
}

export class AdbConnection {
  banner = ''
  private buffer = new Uint8Array(0)
  private nextId = 1
  private streams = new Map<number, Stream>()
  private closed = false
  private closeListeners = new Set<(err: AdbError) => void>()

  private socket: Socket

  private constructor(socket: Socket) {
    this.socket = socket
  }

  static connect(createConnection: CreateConnection, host: string, port: number, timeoutMs = 5000) {
    return new Promise<AdbConnection>((resolve, reject) => {
      const socket = createConnection({ host, port })
      const conn = new AdbConnection(socket)
      let settled = false
      let tcpOpen = false
      const fail = (err: AdbError) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.destroy()
        reject(err)
      }
      const timer = setTimeout(
        () =>
          fail(
            tcpOpen
              ? new AdbError('timeout', 'The TV box did not answer. Another device (e.g. a computer running adb) may already be connected to it.')
              : new AdbError('timeout', 'Connection timed out. Check the IP address and that the box is on.'),
          ),
        timeoutMs,
      )
      socket.on('connect', () => {
        tcpOpen = true
        socket.write(packet(A_CNXN, A_VERSION, MAX_PAYLOAD, encoder.encode('host::\0')))
      })
      socket.on('error', err => {
        const adbErr = socketError(err)
        if (settled) conn.shutdown(adbErr)
        else fail(adbErr)
      })
      socket.on('close', () => {
        if (settled) conn.shutdown(new AdbError('closed', 'Connection to the TV box was lost.'))
        else fail(new AdbError('closed', 'The TV box closed the connection. Another device (e.g. a computer running adb) may already be connected, or ADB is disabled.'))
      })
      socket.on('data', data => {
        try {
          conn.receive(data, (command, arg0, arg1, payload) => {
            if (settled) return conn.handle(command, arg0, arg1, payload)
            if (command === A_AUTH)
              // shortcut: no RSA auth; MXQ Pro has ro.adb.secure=0. Add key signing if a secure box must be supported.
              return fail(new AdbError('auth', 'This TV box requires ADB authorization, which this app does not support yet.'))
            if (command !== A_CNXN) return fail(new AdbError('protocol', 'Unexpected reply from the TV box. Is this an ADB port?'))
            conn.banner = decoder.decode(payload)
            settled = true
            clearTimeout(timer)
            resolve(conn)
          })
        } catch (err) {
          fail(err instanceof AdbError ? err : new AdbError('protocol', String(err)))
        }
      })
    })
  }

  get isOpen() {
    return !this.closed
  }

  onClose(cb: (err: AdbError) => void) {
    this.closeListeners.add(cb)
    return () => this.closeListeners.delete(cb)
  }

  // Runs a one-shot `shell:` command and resolves with its output.
  shell(command: string, timeoutMs = 5000) {
    return new Promise<string>((resolve, reject) => {
      if (this.closed) return reject(new AdbError('closed', 'Not connected to the TV box.'))
      const localId = this.nextId++
      const timer = setTimeout(() => {
        this.streams.delete(localId)
        reject(new AdbError('timeout', 'The TV box did not respond in time.'))
      }, timeoutMs)
      this.streams.set(localId, { remoteId: 0, chunks: [], resolve, reject, timer })
      this.socket.write(packet(A_OPEN, localId, 0, encoder.encode(`shell:${command}\0`)))
    })
  }

  // Opens a long-lived shell whose stdin we can keep writing to (output is discarded).
  openShell(command = 'sh', timeoutMs = 5000) {
    return new Promise<ShellStream>((resolve, reject) => {
      if (this.closed) return reject(new AdbError('closed', 'Not connected to the TV box.'))
      const localId = this.nextId++
      const timer = setTimeout(() => {
        this.streams.delete(localId)
        reject(new AdbError('timeout', 'The TV box did not respond in time.'))
      }, timeoutMs)
      const shell: ShellStream = {
        write: text => this.enqueue(localId, encoder.encode(text)),
        get isOpen() {
          return conn.streams.has(localId)
        },
      }
      const conn = this
      this.streams.set(localId, {
        remoteId: 0,
        chunks: [],
        resolve: () => {},
        reject,
        timer,
        persistent: true,
        ready: false,
        outbox: [],
        onOpen: () => {
          clearTimeout(timer)
          resolve(shell)
        },
      })
      this.socket.write(packet(A_OPEN, localId, 0, encoder.encode(`shell:${command}\0`)))
    })
  }

  private enqueue(localId: number, data: Uint8Array) {
    const stream = this.streams.get(localId)
    if (!stream?.outbox) throw new AdbError('closed', 'Not connected to the TV box.')
    const last = stream.outbox[stream.outbox.length - 1]
    if (last && last.length + data.length <= MAX_PAYLOAD) {
      const merged = new Uint8Array(last.length + data.length)
      merged.set(last)
      merged.set(data, last.length)
      stream.outbox[stream.outbox.length - 1] = merged
    } else stream.outbox.push(data)
    this.flush(localId, stream)
  }

  private flush(localId: number, stream: Stream) {
    if (!stream.ready || !stream.outbox?.length) return
    stream.ready = false
    this.socket.write(packet(A_WRTE, localId, stream.remoteId, stream.outbox.shift()))
  }

  close() {
    this.shutdown(new AdbError('closed', 'Disconnected.'))
  }

  private shutdown(err: AdbError) {
    if (this.closed) return
    this.closed = true
    this.socket.destroy()
    for (const s of this.streams.values()) {
      clearTimeout(s.timer)
      s.reject(err)
    }
    this.streams.clear()
    for (const cb of this.closeListeners) cb(err)
  }

  private receive(data: Uint8Array, onPacket: (command: number, arg0: number, arg1: number, payload: Uint8Array) => void) {
    const merged = new Uint8Array(this.buffer.length + data.length)
    merged.set(this.buffer)
    merged.set(data, this.buffer.length)
    let offset = 0
    while (merged.length - offset >= 24) {
      const view = new DataView(merged.buffer, merged.byteOffset + offset, 24)
      const command = view.getUint32(0, true)
      if (((command ^ 0xffffffff) >>> 0) !== view.getUint32(20, true)) throw new AdbError('protocol', 'Corrupt ADB packet.')
      const length = view.getUint32(12, true)
      if (merged.length - offset < 24 + length) break
      const payload = merged.slice(offset + 24, offset + 24 + length)
      onPacket(command, view.getUint32(4, true), view.getUint32(8, true), payload)
      offset += 24 + length
    }
    this.buffer = merged.slice(offset)
  }

  private handle(command: number, arg0: number, arg1: number, payload: Uint8Array) {
    const stream = this.streams.get(arg1)
    if (!stream) return
    if (command === A_OKAY) {
      const opened = !stream.remoteId
      stream.remoteId = arg0
      stream.ready = true
      if (opened) stream.onOpen?.()
      this.flush(arg1, stream)
    } else if (command === A_WRTE) {
      if (!stream.persistent) stream.chunks.push(decoder.decode(payload))
      this.socket.write(packet(A_OKAY, arg1, arg0))
    } else if (command === A_CLSE) {
      clearTimeout(stream.timer)
      this.streams.delete(arg1)
      // remoteId 0 means the device refused to open the stream.
      if (stream.remoteId) this.socket.write(packet(A_CLSE, arg1, arg0))
      if (stream.remoteId) stream.resolve(stream.chunks.join(''))
      else stream.reject(new AdbError('protocol', 'The TV box refused the command.'))
    }
  }
}
