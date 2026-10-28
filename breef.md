# MXQ Pro Android TV Remote App

## Project Overview

Build an Android remote-control app for an MXQ Pro Android TV box using React Native, Expo, and TypeScript.

The original remote is lost, and I want to control the TV box using my Android phone without buying a replacement.

The app should support three control modes:

1. **D-pad Remote:** Navigate the Android TV interface using directional buttons.
2. **Trackpad:** Use touch gestures to navigate and select items.
3. **Keyboard:** Enter text into supported TV box apps using the phone's native keyboard.

The app must connect directly to the TV box over the local Wi-Fi network whenever technically possible.

## Device Information

- **TV box:** MXQ Pro Android TV box
- **Advertised specifications:** 2GB RAM, 16GB storage
- **Development machine:** MacBook
- **Target device:** Android phone
- **Framework:** React Native + Expo
- **Language:** TypeScript
- **Code style:** No semicolons
- **Default development IP:** `192.168.1.8`
- **Default ADB port:** `5555`

The phone and TV box are connected to the same Wi-Fi network.

## Current ADB Status

ADB over TCP is reachable from my MacBook.

I successfully executed:

```bash
adb connect 192.168.1.8:5555
adb -s 192.168.1.8:5555 shell input keyevent 24
```

The second command successfully increased the TV box volume.

This confirms that ADB commands can control the TV box from my MacBook. However, the Android phone still needs a verified way to communicate with the box directly.

## 1. Initial Screen: Connect to TV Box

**This must be the first screen users see when opening the app for the first time.**

Do not show the remote interface until a connection has been verified.

### UI Requirements

Create a clean connection screen containing:

- App name and a simple remote-control icon.
- TV box IP address input.
- ADB port input.
- Connect button.
- Connection status indicator.
- Progress indicator while connecting.
- Clear error messages if the connection fails.
- A retry option.
- A short explanation that the phone and TV box must be connected to the same local network.

### IP Address Input

The IP address must be editable by the user.

Use the following initial development value:

`192.168.1.8`

Requirements:

- Allow users to enter any valid IPv4 address.
- Do not hardcode the IP address throughout the application.
- Validate the IP address before attempting a connection.
- Show a clear validation error for invalid addresses.
- Allow users to edit the address and retry without restarting the app.

### Port Input

Provide an editable port field.

Default value:

`5555`

Requirements:

- Validate that the port is an integer between `1` and `65535`.
- Use the entered port for connection attempts.
- Do not assume every TV box uses the same ADB port.

### Connection Behavior

When the user presses **Connect**:

1. Validate the IP address and port.
2. Show a loading state and disable duplicate connection attempts.
3. Attempt the supported connection procedure.
4. Verify that actual remote commands can be executed.
5. Navigate to the main remote interface only after verification succeeds.
6. Display a useful error message if the connection fails.

A successful TCP connection alone is not sufficient to confirm that ADB commands will work.

Handle common errors, including:

- Invalid IP address or port.
- TV box unreachable.
- Connection timeout.
- ADB authentication or pairing failure.
- ADB disabled on the TV box.
- Unsupported connection method.
- Connection lost after initial success.

Do not show a fake successful connection.

### Remembering the Connection

After a successful connection, remember the last successfully used IP address and port locally.

On subsequent launches:

- Restore the saved connection details.
- Attempt to reconnect automatically if appropriate.
- Display connection progress and the actual connection status.
- Allow the user to cancel or edit the saved address.
- If reconnection fails, show the connection screen with the previous values prefilled.

Provide a connection settings option in the main interface so users can change the IP address or port later.

Use appropriate local persistence, such as AsyncStorage, and avoid storing unnecessary sensitive information.

## 2. Main Remote Interface

After a verified connection, navigate to the main remote interface.

The interface should offer three modes:

- D-pad Remote
- Trackpad
- Keyboard

Use simple navigation, large touch targets, and a layout that works well on different Android phone sizes.

The app should show the current connection status and provide a way to reconnect or change connection settings.

## 3. D-pad Remote Mode

Create a conventional TV remote layout.

### Required Controls

- Up
- Down
- Left
- Right
- OK / Select
- Back
- Home
- Volume Up
- Volume Down
- Menu, if supported by the device

### Behavior

- Each button should send the appropriate command to the connected TV box.
- Buttons should have clear pressed states.
- Repeated presses should be handled reliably.
- Avoid sending duplicate commands caused by accidental multiple taps.
- Handle disconnected states without crashing.
- Provide feedback if a command fails.

Use these Android key event codes as the initial reference:

```typescript
export const KEY_EVENTS = {
  HOME: 3,
  BACK: 4,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  DPAD_CENTER: 23,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25
} as const
```

Verify the commands against the actual device. Additional key events should only be added when their behavior is known.

## 4. Trackpad Mode

Create a dedicated trackpad-style control area.

### Initial Behavior

- Swipe up to navigate up.
- Swipe down to navigate down.
- Swipe left to navigate left.
- Swipe right to navigate right.
- Tap to select the currently focused item.
- Prevent accidental repeated navigation from a single gesture.
- Make gesture sensitivity configurable if necessary.

### Important Technical Limitation

Directional swipe navigation is not the same as controlling a real mouse cursor.

True mouse movement, arbitrary touch injection, or cursor positioning may require elevated permissions, a companion service, a privileged system component, or another supported mechanism.

Investigate what the specific TV box supports before implementing these features. Do not promise real cursor control unless it has been verified to work.

If genuine cursor control is not possible through the chosen architecture, implement reliable directional swipe navigation and explain the limitation in the project documentation.

## 5. Keyboard Mode

Allow users to enter text into supported TV box apps using their phone's native keyboard.

### Requirements

- Provide a text input field.
- Open the native Android keyboard when the user starts typing.
- Provide a Send or Enter action.
- Support spaces and common punctuation.
- Support pasting text where practical.
- Handle empty input and connection failures.
- Clear the input after successful submission only when appropriate.
- Provide feedback when text entry fails.

Investigate the limitations of Android's `input text` command, especially for Unicode, special characters, spaces, and different application input fields.

Do not assume every application will accept text injection. If the selected ADB method cannot reliably support certain characters, document the limitation and implement the best verified alternative.

## 6. Connection Management

Create a reusable connection service responsible for connecting to the TV box and sending remote commands.

It should support:

- Connecting using a custom IP address and port.
- Disconnecting.
- Reconnecting.
- Checking the actual connection state.
- Sending key events.
- Reporting errors.
- Handling timeouts.
- Preventing commands from being sent while disconnected.

The UI should never pretend the device is connected when it is not.

Keep connection logic separate from UI components.

## 7. Critical Technical Investigation: Android-to-Android ADB

**Before building the full remote interface, determine how the Android phone can communicate directly with the TV box using ADB.**

ADB is a debugging protocol, not a normal HTTP API. A React Native application cannot execute the Mac's `adb` command directly, and the Android phone does not automatically have the ADB command-line tools installed.

Research and verify a viable architecture.

Investigate:

1. Whether a compatible Android-side ADB client library exists.
2. Whether it supports direct ADB connections to a remote Android device.
3. Whether it supports the authentication requirements of this TV box.
4. Whether a React Native native module is needed.
5. Whether an Expo development build is required.
6. Whether a supported local network control protocol is available as an alternative.
7. Whether ADB must be enabled manually in the TV box settings.
8. Whether this device requires pairing or uses a legacy ADB-over-TCP configuration.
9. Whether commands such as `input keyevent` can be executed through the chosen implementation.

Do not assume that opening a TCP socket to port `5555` is enough to control the TV box. ADB requires protocol handling and may require authentication.

Do not use the MacBook as a permanent intermediary. The goal is to control the TV box directly from the Android phone.

If direct ADB communication is not feasible with the current Expo setup, explain the limitation and recommend the most practical architecture before proceeding.

Do not add unnecessary native dependencies before establishing that they solve the actual problem.

## 8. Suggested Project Structure

Adapt this structure to the existing repository. Do not recreate the project or introduce unnecessary abstractions if a suitable structure already exists.

```text
src/
  components/
    RemoteButton.tsx
    DPad.tsx
    Trackpad.tsx
    KeyboardInput.tsx
    ConnectionStatus.tsx
  screens/
    ConnectionScreen.tsx
    RemoteScreen.tsx
    TrackpadScreen.tsx
    KeyboardScreen.tsx
  services/
    adbClient.ts
    remoteController.ts
  constants/
    keyEvents.ts
  types/
    remote.ts
  hooks/
    useConnection.ts
```

Suggested responsibilities:

- `ConnectionScreen.tsx`: IP and port inputs, connection validation, connection progress, and error handling.
- `RemoteScreen.tsx`: Main navigation and D-pad remote.
- `TrackpadScreen.tsx`: Gesture controls.
- `KeyboardScreen.tsx`: Text input and submission.
- `adbClient.ts`: Actual communication with the TV box through the verified transport.
- `remoteController.ts`: High-level remote commands.
- `useConnection.ts`: Connection state and lifecycle management.
- `keyEvents.ts`: Verified Android key event constants.

Use the existing project's conventions wherever possible.

## 9. UI and UX Requirements

The interface should be clean, modern, and easy to use with one hand.

Prioritize:

- Large, accessible touch targets.
- Responsive layouts.
- Clear labels and icons.
- Distinct active and pressed states.
- Smooth but lightweight interactions.
- Clear loading, disconnected, connected, and error states.
- Simple switching between D-pad, trackpad, and keyboard modes.
- No unnecessary animations or heavy dependencies.
- Good performance on ordinary Android phones.

The connection screen should be simple and practical rather than overloaded with decorative elements.

## 10. Error Handling and Reliability

Handle connection failures gracefully.

Requirements:

- Validate input before making a connection attempt.
- Add reasonable timeouts.
- Prevent overlapping connection attempts.
- Prevent duplicate command execution caused by repeated taps.
- Recover from temporary Wi-Fi disconnections.
- Keep the displayed connection state synchronized with the actual connection.
- Avoid crashes when the TV box becomes unavailable.
- Display actionable error messages rather than generic failures.
- Release resources when the connection is closed or the application is disposed.

Do not silently swallow errors during development. Log useful diagnostic information without exposing sensitive information.

## 11. Security

- Restrict ADB access to a trusted local network.
- Never expose ADB to the public internet.
- Do not recommend disabling the computer's firewall globally.
- Do not bypass ADB authentication.
- Do not store unnecessary credentials or debugging secrets.
- Explain any required TV box settings and permissions.
- Do not introduce an external server unless technically necessary.

## 12. Development Plan

### Phase 1: Inspect the Existing Project

Before modifying code:

1. Inspect the current repository and package dependencies.
2. Identify the Expo SDK version and whether the project uses Expo Go or a development build.
3. Determine whether native Android modules can be used in the current setup.
4. Investigate viable direct phone-to-TV-box communication methods.
5. Explain the selected architecture and any limitations.

Do not start by generating every screen. Verify the most important technical assumption first.

### Phase 2: Build the Connection Screen

Implement:

- Editable IP address input.
- Editable ADB port input.
- Validation.
- Connection and retry buttons.
- Loading and error states.
- Local persistence of the last successful connection details.

Use `192.168.1.8` and `5555` as the initial development values, not permanent hardcoded values.

### Phase 3: Build a Minimal Working Prototype

Implement the smallest end-to-end feature that proves the architecture works.

Start with volume up and volume down.

Verify that:

1. The phone connects directly to the actual TV box.
2. The app can execute the required command.
3. The TV box volume changes.
4. Connection failures are handled correctly.
5. The feature works without requiring the MacBook to act as a server.

Only report success after testing the actual connection.

### Phase 4: Implement the D-pad

Add Up, Down, Left, Right, OK, Back, and Home.

Test every command on the real TV box.

### Phase 5: Implement Trackpad Mode

Add directional swipe gestures and tap-to-select.

Investigate real cursor control separately and implement it only if supported by the selected architecture.

### Phase 6: Implement Keyboard Mode

Add native keyboard input and send text to supported applications.

Test spaces, punctuation, Unicode limitations, and Enter behavior.

### Phase 7: Polish and Test

Add:

- Reconnection.
- Connection settings.
- Persistent connection details.
- Better error messages.
- Responsive styling.
- Gesture refinements.
- Lifecycle cleanup.
- Testing instructions.

## 13. Acceptance Criteria

The project is complete when:

- The app opens to the connection screen on first launch.
- Users can enter a custom IP address and port.
- Invalid values are rejected with useful messages.
- The app connects to the real TV box using a verified communication method.
- The app remembers the last successfully used IP address and port.
- The main remote interface appears only after the connection is verified.
- Volume controls work on the actual TV box.
- D-pad navigation works on the actual TV box.
- Trackpad gestures work as documented.
- Keyboard input works in supported applications.
- Connection failures and lost connections are handled gracefully.
- Users can change the connection settings later.
- The app does not rely on a permanently running MacBook process.
- No connection or remote-control functionality is simulated.

## First Task

**Inspect the existing project and verify the direct Android-phone-to-MXQ-Pro communication method before implementing the full application.**

Start by determining whether direct ADB communication is feasible with the current Expo and React Native setup. Then build the initial connection screen and a working volume-control prototype.

Prioritize real functionality over UI polish. Do not assume that a solution works merely because it compiles. Test it against the actual TV box and clearly explain any technical limitations before moving to the next phase.