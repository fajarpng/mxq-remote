# MXQ Remote

**Control your MXQ Pro Android TV box from your Android phone over Wi-Fi.**

MXQ Remote is a React Native application built with Expo that communicates directly with an MXQ Pro TV box using the Android Debug Bridge (ADB) protocol. It provides D-pad navigation, trackpad controls, mouse cursor support, and text input without requiring a computer or server at runtime.

> **Status:** Developed for an MXQ Pro TV box. Compatibility with other Android TV boxes depends on their firmware, ADB configuration, and input devices.

## Features

- **D-pad Remote:** Navigate with directional buttons, OK, Back, Home, Menu, and volume controls.
- **Trackpad Mode:** Swipe to navigate the Android TV interface and tap to select items.
- **Mouse Cursor Mode:** Control Android's real mouse pointer when a compatible USB mouse receiver is connected to the TV box.
- **Keyboard Input:** Send text to focused TV input fields using your phone's keyboard.
- **Custom Connection:** Configure the TV box's IP address and ADB port.
- **Connection Management:** Validate connections, report errors, and reconnect when needed.
- **Direct Communication:** Connect over the local network without a computer or external server at runtime.

## How It Works

MXQ Remote implements the ADB wire protocol in TypeScript and communicates with the TV box over a raw TCP socket.

The main components are:

| Component | Responsibility |
|---|---|
| `adbClient.ts` | Handles ADB protocol messages, including `CNXN`, `OPEN`, `WRTE`, `OKAY`, and `CLSE`. |
| `remoteController.ts` | Verifies connectivity and executes remote-control commands. |
| Input device discovery | Reads `getevent -p`, `dumpsys input`, and available key-layout files to identify input devices and key mappings. |
| Hardware key injection | Writes raw `input_event` structures to a compatible input device when permissions allow. |
| Persistent shell session | Streams mouse movement commands through a reusable shell session. |

The implementation uses `react-native-tcp-socket` for native TCP socket access.

### Why use hardware input events?

On the tested MXQ Pro, the `input keyevent` command takes approximately five seconds per key because it starts a JVM for each invocation.

Writing input events directly to a compatible hardware input device takes approximately 150 milliseconds per key, making navigation much more responsive.

The slower `input keyevent` method remains available as a fallback for keys that cannot be mapped to a hardware input device.

Actual performance depends on the device and its firmware.

## Requirements

- An Android phone.
- An MXQ Pro TV box or a compatible Android device with accessible ADB.
- A Wi-Fi network connecting both devices.
- A TV box with ADB over TCP enabled.
- An Android development environment for building the application.
- A development or release build of the app.

**Expo Go is not supported** because it does not include the native TCP socket module required by this project.

## TV Box Setup

### 1. Enable ADB

On the TV box, navigate to:

`Settings → Developer options → USB debugging / ADB debugging`

Enable debugging and network ADB access if the firmware provides separate settings.

On the tested MXQ Pro, ADB over TCP is already enabled on port `5555`.

Menu names and available options may differ between devices.

### 2. Find the IP Address

Open the TV box's network settings and find its local IP address.

For the development device, the address is:

```text
192.168.1.8
```

### 3. Connect Both Devices to Wi-Fi

Make sure the Android phone and TV box are on the same local network.

Guest Wi-Fi networks, client isolation, and firewall rules can prevent devices from communicating with each other.

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

Replace the placeholders with the actual repository URL and directory name.

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate the Android Project

```bash
npx expo prebuild --platform android
```

This generates the native Android project required by the TCP socket dependency.

### 4. Build the Release APK

```bash
cd android
./gradlew assembleRelease
```

The APK is generated at:

```text
android/app/build/outputs/apk/release/app-release.apk
```

The APK may require signing configuration appropriate to your distribution method. Verify the build output and signing settings before distributing it.

## Installing Without a USB Cable

You can transfer the APK over your local network using your MacBook.

From the directory containing the APK, run:

```bash
python3 -m http.server 8000 --bind <mac-lan-ip>
```

Replace `<mac-lan-ip>` with your MacBook's local network IP address.

On your Android phone, open a browser and visit:

```text
http://<mac-lan-ip>:8000
```

Select the APK and download it.

You may need to allow installation from the browser or file manager used to open the APK.

Once installation is complete, stop the temporary server with `Ctrl+C`.

Keep this temporary server restricted to your trusted local network.

## Using the App

### Connect to the TV Box

On the first launch, the app displays a connection screen.

1. Enter the TV box's IP address.
2. Enter the ADB port, normally `5555`.
3. Tap **Connect**.
4. Wait for the connection to be verified.
5. Use the remote controls after successful verification.

The connection screen validates the address and port before attempting to connect. Connection failures should display an actionable error message rather than opening the remote interface prematurely.

### D-pad Remote

Use the directional controls to navigate menus and applications.

Available controls include:

- Up, Down, Left, and Right
- OK / Select
- Back
- Home
- Menu
- Volume Up and Volume Down

The exact behavior of some buttons depends on the TV box's input mappings and firmware.

### Trackpad

Swipe in any direction to navigate the currently focused interface.

Tap to select an item.

Without a compatible mouse receiver, trackpad mode provides directional navigation rather than unrestricted pointer movement.

### Mouse Cursor

Connect the TV box's compatible **2.4 GHz USB mouse receiver** before using mouse cursor mode.

The app sends pointer movement through a persistent shell session.

Android applies pointer acceleration, so faster drags can move the cursor farther than slower drags over the same distance.

### Keyboard

Focus a text field on the TV, enter text on your phone, and send it to the device.

Text input uses Android's `input text` command.

See the limitations below for character support and application compatibility.

## Known Limitations

### ADB Connection

**One ADB client at a time:** The tested box's ADB daemon supports only one client at a time.

If your computer is already connected, disconnect it before connecting from the phone:

```bash
adb disconnect 192.168.1.8:5555
```

The reverse also applies: disconnect the phone before connecting from the computer.

The app releases its connection when it moves to the background and reconnects when it returns to the foreground.

**Authentication:** The tested MXQ Pro reports `ro.adb.secure=0`, so it does not require standard ADB RSA authorization in its current configuration.

Devices requiring RSA authorization are not supported by the current implementation and should display an explicit error.

### Text Input

Text input has the following limitations:

- Only printable ASCII characters are supported.
- Accented characters and emoji are rejected.
- Sending text takes approximately three seconds on the tested box.
- A literal `%s` in the input is interpreted as a space by the current implementation.
- Text is sent to whichever field currently has focus.
- Some applications ignore injected text.

### Enter Key

The app sends `NUMPAD_ENTER` for the Enter action.

On the tested box, `Generic.kl` maps scan code `28` to `DPAD_CENTER`. Using `KEYCODE_ENTER` would require the slower `input keyevent` fallback.

Standard text fields accept `NUMPAD_ENTER`, but some applications may not.

### Mouse Cursor

Mouse cursor mode requires the compatible 2.4 GHz USB mouse receiver to be plugged into the TV box.

Without the receiver, the app falls back to directional trackpad navigation.

### Device Compatibility

The implementation has been developed for a specific MXQ Pro configuration.

Other Android TV boxes may differ in:

- ADB availability and authentication.
- Input device permissions.
- Hardware key mappings.
- Mouse and keyboard support.
- Android version and firmware behavior.

Compatibility must be tested on each target device. Do not assume that every Android TV or Google TV device exposes the same capabilities.

## Testing Checklist

Test each feature against the actual TV box rather than relying only on successful compilation.

| Test | Action | Expected result |
|---|---|---|
| First launch | Open the app | Connection screen with `192.168.1.8` and port `5555` prefilled |
| IP validation | Enter `192.168.1.300` | Validation error; no connection attempt |
| Port validation | Enter port `0` | Validation error; no connection attempt |
| Unreachable device | Enter an unused IP | Timeout after approximately five seconds, with retry available |
| Busy connection | Connect ADB from a computer first | Connection error explaining that another client may be connected |
| Successful connection | Enter the correct IP and port | Remote screen opens after verification |
| D-pad | Press each direction and OK | TV interface responds correctly |
| Navigation | Press Back, Home, and Menu | Expected navigation behavior, where supported |
| Volume | Press Volume Up and Volume Down | TV box responds to volume commands |
| Trackpad | Swipe in four directions and tap | Navigation occurs once per swipe; tap selects |
| Mouse cursor | Connect the USB receiver and drag | Pointer moves and tapping clicks |
| Keyboard | Type `hello world!` and send | Text appears in the focused field |
| Enter | Submit text using Enter | Focused field handles submission where supported |
| Lost connection | Turn off the box or disable Wi-Fi | Reconnecting state appears, followed by an error or connection screen if recovery fails |
| Background behavior | Background the app | The ADB connection is released |
| Relaunch | Close and reopen the app | Saved connection details are restored and reconnection is attempted |
| Connection settings | Open connection settings | Existing connection is closed and editable connection details are shown |

## Security

ADB provides powerful shell access to the TV box. Treat it as a privileged debugging interface, not a harmless remote-control port.

- Use ADB only on a trusted local network.
- Never forward port `5555` on your router.
- Never expose ADB directly to the public internet.
- Do not disable your firewall globally to make connections work.
- Avoid connecting to unfamiliar devices.
- Do not bypass ADB authentication on devices that require it.
- Disconnect ADB when it is no longer needed.

The tested MXQ Pro has insecure ADB configuration with `ro.adb.secure=0`. This is a device security weakness, not a recommended configuration for other devices.

## Tech Stack

- React Native
- Expo
- TypeScript
- `react-native-tcp-socket`
- Android Debug Bridge (ADB)
- Android input events and shell commands

## Roadmap

Potential improvements include:

- Support for more Android TV boxes and firmware variants.
- Android TV Remote protocol support for compatible devices.
- Automatic discovery of compatible devices on the local network.
- Better keyboard handling and Unicode support.
- Improved connection recovery and diagnostics.
- Configurable key mappings.
- Additional device-specific control integrations.

These are planned possibilities, not features guaranteed to work in the current implementation.

## Contributing

Contributions are welcome, particularly improvements to ADB compatibility, device discovery, input handling, and testing across different Android TV boxes.

When reporting an issue, include:

- TV box model.
- Android version or firmware, if known.
- ADB configuration.
- Steps to reproduce the issue.
- Relevant logs with sensitive information removed.

## License

Add the project's chosen license here before distributing or accepting external contributions.
