# MXQ Remote

Android phone remote for an MXQ Pro TV box, built with Expo / React Native. The phone talks to the box directly over Wi-Fi using the ADB protocol. No computer or server is needed at runtime.

## How it works

- `src/services/adbClient.ts` implements the ADB wire protocol (CNXN / OPEN / WRTE / OKAY / CLSE) in TypeScript over a raw TCP socket from `react-native-tcp-socket`.
- `src/services/remoteController.ts` verifies the connection by running a test command. It then reads the box's input devices (`getevent -p`) and key layouts (`dumpsys input`, `.kl` files).
- Keys are injected by writing raw `input_event` structs to a hardware input device, such as the IR receiver `/dev/input/event0`. This takes about 150 ms per key. `input keyevent` takes about 5 s on this box because it starts a JVM each time, so it is used only as a fallback for keys no device maps.
- If a mouse device is present (the box's "2.4G Mouse" USB dongle), the trackpad can drive Android's real mouse cursor. Cursor movement streams through one persistent `sh` session.

## TV box setup

1. Enable ADB over network on the box: **Settings → Developer options → USB debugging / ADB debugging**. On the MXQ Pro it is already on, at port `5555`.
2. Find the box's IP address under **Settings → Network**.
3. Keep the phone and the box on the same Wi-Fi network.

**Security:** ADB gives full shell access to the box. Use it only on a trusted home network. Never forward port 5555 on your router or expose it to the internet.

## Building and installing

A development build or release build is required. Expo Go does not include the TCP socket native module.

```bash
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Without a USB cable, serve the APK on the local network and download it in the phone's browser:

```bash
cd android/app/build/outputs/apk/release && python3 -m http.server 8000 --bind <mac-lan-ip>
```

Stop the server once the APK is installed.

## Known limitations

- **One ADB client at a time.** The box's adbd serves only one client. If a computer is connected (`adb connect`), the phone cannot connect, and the reverse. Run `adb disconnect <ip>:5555` on the computer first. The app releases the connection when it goes to the background and reconnects when it comes back.
- **No ADB authorization support.** The MXQ Pro has `ro.adb.secure=0`. A box that requires RSA authorization shows an explicit error instead.
- **Text input** uses `input text`:
  - It accepts printable ASCII only. The app rejects other characters, such as accented letters or emoji, with a message.
  - Sending takes about 3 s.
  - A literal `%s` in your text is sent as a space.
  - The text goes to whichever field has focus on the TV. Some apps ignore injected text.
- **Enter** sends `NUMPAD_ENTER`. This box's `Generic.kl` maps scan code 28 to `DPAD_CENTER`, and `KEYCODE_ENTER` would need the slow `input keyevent` path. Standard text fields accept `NUMPAD_ENTER`. A few apps may not.
- **Mouse cursor mode** needs the 2.4G mouse USB dongle plugged into the box. Without it, the trackpad offers swipe navigation only. Android applies pointer acceleration, so fast drags move further.

## Testing checklist (on the real box)

| Area | Steps | Expected |
| --- | --- | --- |
| First launch | Open the app | Connection screen, prefilled `192.168.1.8` / `5555` |
| Validation | Enter `192.168.1.300` or port `0` | Inline error, no connection attempt |
| Unreachable | Enter an unused IP | "Connection timed out…" after 5 s, Retry shown |
| Busy | Run `adb connect` on a computer, then Connect | "Another device … may already be connected" |
| Connect | Correct IP and port | Remote screen opens only after verification |
| D-pad | Each arrow, OK, Back, Home, Menu | The TV responds to each key |
| Volume | − / + | TV volume changes |
| Trackpad swipe | Swipe in 4 directions, tap | One move per swipe, tap selects |
| Mouse cursor | Switch to "Mouse cursor", drag, tap | Pointer moves, tap clicks |
| Keyboard | Focus a TV text field, type `hello world!`, Send, then ⏎ | Text appears, Enter submits |
| Lost connection | Turn the box off or switch Wi-Fi off | "Reconnecting…" banner, then the connection screen with an error |
| Background | Background the app, run `adb connect` on the computer | The computer can connect |
| Relaunch | Kill and reopen the app | Reconnects automatically to the saved box |
| Settings | Tap "Connection settings" | Disconnects and returns to the editable connection screen |
