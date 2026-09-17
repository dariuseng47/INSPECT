# react-native-rfid-orca50

Bridge to the RodinBell Orca 50's built-in UHF RFID reader (Impinj-based module, vendor SDK
package `com.rfid.*` / `com.xdl2d.scanner.*` / `com.module.interaction.*`). Sourced from
[Eric-LLi/rfid-orca-50](https://github.com/Eric-LLi/rfid-orca-50), modernized for RN 0.86 /
AGP 8+ (namespace, no jcenter, no `com.android.support`).

## Important: armeabi-v7a only

The vendor's native libs (`libmodule_manager.so`, `libserial_port.so`) only ship for
**armeabi-v7a** — the Orca 50's Cortex-A17 CPU is 32-bit ARM, so that's all it ever needed.
This means:

- It will **not** load on an arm64-only emulator/build. Builds must include `armeabi-v7a` in
  the target ABIs (don't rely on a single-arch `--device`-based `expo run:android`, which
  usually only builds for the connected device's own primary ABI — that's fine when deploying
  straight to a real Orca 50, but a universal/multi-ABI build is needed for any distribution
  build, e.g. `eas build` or `gradlew assembleRelease` without ABI splitting).
- On other Android devices (emulators, phones) the app must simply skip RFID hardware calls —
  guard `OrcaScanner` usage behind the device-type setting (see
  `src/rfid/deviceSettings.js` / the "ตั้งค่าเครื่อง" screen), never call it unconditionally.

## API (`src/OrcaScanner.js`)

- `connect()` → `Promise<boolean>` — opens the serial connection to the built-in RFID +
  barcode modules (`dev/ttyS4` @ 115200 for RFID, `dev/ttyS1` @ 9600 for barcode).
- `disconnect()` — releases the modules.
- `isConnected()` → `Promise<boolean>`.
- `startRead()` / `stopRead()` — there is no separate "single read" primitive in the vendor
  SDK; `startRead()` begins continuous inventory and emits `OrcaEvent.Tag` once per unique EPC
  seen since the last `cleanTagBuffer()`. "Single read" is implemented at the app layer by
  calling `startRead()`, taking the first `Tag` event, then immediately `stopRead()`. "Bulk
  read" keeps it running and collects every unique `Tag` event until the user stops it.
- `cleanTagBuffer()` — clears the de-duplication buffer between scan sessions.
- `setAntennaPower(level: string)` / `getAntennaPower()` — the get is async, result arrives via
  the `OrcaEvent.GetPowerLevel` event, not a return value.
- Events (`OrcaEvent`): `Tag` (string EPC), `Barcode` (string), `ExeError` (string message),
  `GetPowerLevel` (string).
