import { AdbConnection, AdbError, type CreateConnection, type ShellStream } from './adbClient'
import { KEY_EVENTS, type KeyName } from '../constants/keyEvents'

// `input keyevent` boots a JVM and takes ~5 s per press on the MXQ Pro.
// Writing raw evdev events to a hardware input device (e.g. the IR receiver) takes ~40 ms,
// so keys are injected that way when the box's own key layout maps them; otherwise we fall back.
type FastKey = { path: string; scanCode: number }

const INPUT_TIMEOUT = 15000
const EV_SYN = 0
const EV_KEY = 1
const EV_REL = 2
const REL_X = 0
const REL_Y = 1
const BTN_LEFT = 0x110

export function parseKeymap(abi: string, devices: string, layouts: string) {
  // Device capabilities from `getevent -p`: which KEY / REL codes each device declares.
  const caps = new Map<string, { KEY: Set<number>; REL: Set<number> }>()
  let device = ''
  let section = ''
  for (const line of devices.split('\n')) {
    const add = line.match(/^add device \d+: (\S+)/)
    const head = line.match(/^\s+([A-Z]+) \([0-9a-f]{4}\):(.*)$/)
    if (add) {
      device = add[1]
      caps.set(device, { KEY: new Set(), REL: new Set() })
      section = ''
    } else if (head) section = head[1]
    else if (!/^\s+([0-9a-f]{4}\s*)+$/.test(line)) section = ''
    const set = caps.get(device)?.[section as 'KEY' | 'REL']
    if (set)
      for (const hex of (head ? head[2] : line).trim().split(/\s+/))
        if (/^[0-9a-f]{4}$/.test(hex)) set.add(parseInt(hex, 16))
  }

  // Key layouts: "DEV <path>" header followed by that device's "key <scan> <NAME>" lines.
  const keymap = new Map<number, FastKey>()
  device = ''
  for (const line of layouts.split('\n')) {
    const dev = line.match(/^DEV (\S+)/)
    const key = line.match(/^key (\d+)\s+(\w+)/)
    if (dev) device = dev[1]
    else if (key && key[2] in KEY_EVENTS) {
      const code = KEY_EVENTS[key[2] as KeyName]
      const scanCode = Number(key[1])
      if (!keymap.has(code) && caps.get(device)?.KEY.has(scanCode)) keymap.set(code, { path: device, scanCode })
    }
  }

  // A mouse (e.g. the air-mouse USB dongle) lets us drive Android's real pointer.
  const pointer = [...caps].find(([, c]) => c.REL.has(REL_X) && c.REL.has(REL_Y) && c.KEY.has(BTN_LEFT))?.[0] ?? null
  return { keymap, pointer, eventSize: /64/.test(abi) ? 24 : 16 }
}

// struct input_event: timeval (zeroed, kernel stamps it), u16 type, u16 code, s32 value.
export function eventBytes(events: number[][], eventSize: number) {
  const out = new Uint8Array(eventSize * events.length)
  const view = new DataView(out.buffer)
  events.forEach(([type, code, value], i) => {
    const at = i * eventSize + eventSize - 8
    view.setUint16(at, type, true)
    view.setUint16(at + 2, code, true)
    view.setInt32(at + 4, value, true)
  })
  return Array.from(out, b => '\\x' + b.toString(16).padStart(2, '0')).join('')
}

export function pressEvents(code: number) {
  return [[EV_KEY, code, 1], [EV_SYN, 0, 0], [EV_KEY, code, 0], [EV_SYN, 0, 0]]
}

// `input text` only handles printable ASCII; it reads "%s" as a space, so spaces are sent that way.
export function inputTextCommand(text: string) {
  if (!/^[\x20-\x7e]+$/.test(text)) throw new AdbError('protocol', 'Only plain English letters, numbers and symbols can be sent.')
  return `input text '${text.replace(/'/g, "'\\''").replace(/ /g, '%s')}'`
}

export class RemoteController {
  private adb: AdbConnection
  private keymap: Map<number, FastKey>
  private eventSize: number
  private pointer: string | null
  private pointerShell: Promise<ShellStream> | null = null

  private constructor(adb: AdbConnection, keymap: Map<number, FastKey>, pointer: string | null, eventSize: number) {
    this.adb = adb
    this.keymap = keymap
    this.pointer = pointer
    this.eventSize = eventSize
  }

  // Connects and proves shell commands actually run before reporting success.
  static async connect(createConnection: CreateConnection, host: string, port: number) {
    const adb = await AdbConnection.connect(createConnection, host, port)
    try {
      if ((await adb.shell('echo mxq-ok')).trim() !== 'mxq-ok')
        throw new AdbError('protocol', 'Connected, but the TV box did not run a test command.')
      const abi = await adb.shell('getprop ro.product.cpu.abi')
      const devices = await adb.shell('getevent -p')
      const layouts = await adb.shell(
        "dumpsys input | grep -E 'Path: /dev/input/|KeyLayoutFile: ' | while read k v; do " +
          '[ "$k" = Path: ] && echo "DEV $v"; [ "$k" = KeyLayoutFile: ] && grep -E "^key [0-9]+ " "$v"; done',
      )
      const { keymap, pointer, eventSize } = parseKeymap(abi, devices, layouts)
      return new RemoteController(adb, keymap, pointer, eventSize)
    } catch (err) {
      adb.close()
      throw err
    }
  }

  get isOpen() {
    return this.adb.isOpen
  }

  get hasPointer() {
    return this.pointer !== null
  }

  onClose(cb: (err: AdbError) => void) {
    return this.adb.onClose(cb)
  }

  async key(name: KeyName) {
    const code = KEY_EVENTS[name]
    const fast = this.keymap.get(code)
    const out = fast
      ? await this.adb.shell(`echo -ne '${eventBytes(pressEvents(fast.scanCode), this.eventSize)}' > ${fast.path}`)
      : await this.adb.shell(`input keyevent ${code}`, INPUT_TIMEOUT)
    // Both commands print nothing on success.
    if (out.trim()) throw new AdbError('protocol', out.trim().split('\n')[0])
  }

  async text(text: string) {
    const out = await this.adb.shell(inputTextCommand(text), INPUT_TIMEOUT)
    if (out.trim()) throw new AdbError('protocol', out.trim().split('\n')[0])
  }

  // Cursor moves stream through one persistent shell: one-shot commands are too slow for dragging.
  async movePointer(dx: number, dy: number) {
    await this.writePointer([[EV_REL, REL_X, Math.round(dx)], [EV_REL, REL_Y, Math.round(dy)], [EV_SYN, 0, 0]])
  }

  async click() {
    await this.writePointer(pressEvents(BTN_LEFT))
  }

  private async writePointer(events: number[][]) {
    if (!this.pointer) throw new AdbError('protocol', 'No mouse device found on the TV box.')
    const open = () =>
      (this.pointerShell = this.adb.openShell().catch(err => {
        this.pointerShell = null
        throw err
      }))
    let shell = await (this.pointerShell ?? open())
    if (!shell.isOpen) shell = await open()
    shell.write(`echo -ne '${eventBytes(events, this.eventSize)}' > ${this.pointer}\n`)
  }

  close() {
    this.adb.close()
  }
}
