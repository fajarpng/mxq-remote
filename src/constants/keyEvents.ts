// Android KeyEvent codes. Names match the key layout (.kl) names on the box,
// which remoteController uses to find the matching hardware scan codes.
export const KEY_EVENTS = {
  HOME: 3,
  BACK: 4,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  DPAD_CENTER: 23,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  DEL: 67,
  MENU: 82,
  // MXQ Pro's Generic.kl maps scan 28 to DPAD_CENTER, so Enter uses the keypad Enter key, which text fields also accept.
  NUMPAD_ENTER: 160
} as const

export type KeyName = keyof typeof KEY_EVENTS
