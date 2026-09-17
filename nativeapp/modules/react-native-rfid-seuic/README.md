# react-native-rfid-seuic

Bridge ไป UHF RFID module + ปุ่มไกในตัวเครื่อง **SEUIC AUTOID UTouch 2** (Android 11, arm64)
ผ่าน system SDK ของ SEUIC — `com.seuic.uhf.UHFService` + `com.seuic.scankey.ScanKeyService`
(คุยกับ system server `com.seuic.uhfserver` / `scankeyservice` ที่มากับ ROM)

โครง API เลียนแบบ `react-native-rfid-orca50` เพื่อให้ `src/rfid/drivers.js` สลับสองเครื่องได้
โดยแทบไม่ต้องแยกโค้ด

## ต่างจาก Orca 50

| | Orca 50 | SEUIC UTouch 2 |
|---|---|---|
| Native libs | bundle `.so` เอง (armeabi-v7a) | **system framework** — ไม่ bundle, ไม่มี `jniLibs/` |
| jars | `implementation` (vendor SDK จริง) | **`compileOnly`** — คลาสอยู่ใน boot classpath ของ ROM |
| `<uses-library>` | — | **ไม่ต้อง** (ตาม UHFTool ของ SDK ที่คอมเมนต์ทิ้ง) |
| อ่านแท็ก | คุม protocol byte เอง | `registerReadTags()` push callback → `TagEvent` |
| ปุ่มไก | firmware `setTrigger(true)` + เดา release ด้วย debounce | **`TriggerDown` / `TriggerUp` จริง** (scancode 250) |
| single read | ไม่มี (start แล้วหยุดที่ tag แรก) | `inventoryOnce()` มีจริง (ยังไม่ได้ใช้) |

## `libs/`

- `uhf.jar` (16 KB, ก.ย. 2025) — จาก `seuic-autoid-utouch-2-SDK-LATEST/uhf.jar`
- `scankey.jar` (1.9 KB) — จาก `seuic-autoid-utouch-2-SDK-LATEST/UHFTool/app/libs/scankey.jar`

ทั้งคู่เป็นแค่ client stub ของ system service — เวอร์ชันจริงมาจาก ROM ตอน runtime

## API (`src/SeuicScanner.js`)

- `connect()` → `Promise<boolean>` — `UHFService.open()` + ตั้ง region `China1` (920–925 MHz =
  ย่านไทย) / power 30 / session S2 / profile P1 / target A + `registerReadTags` +
  `ScanKeyService.registerCallback(cb, "250")`
- `disconnect()` — unregister ทั้งหมด + `close()`
- `isConnected()` → `Promise<boolean>`
- `startRead()` / `stopRead()` — `inventoryStart()` / `inventoryStop()` (ฝั่ง JS `useTriggerScan`
  เป็นตัวสั่งรอบ ๆ `TriggerDown`/`TriggerUp`)
- `cleanTagBuffer()` — ล้าง dedup set + `PARAMETER_CLEAR_EPCLIST`
- `setAntennaPower(level)` / `getAntennaPower()` — `setPower()` (1–33 dBm) / `getPower()` (async,
  ผลมาทาง event `getPowerLevel`)
- `on(event, cb)` / `removeon(event, cb)` — one listener ต่อ event
- Events (`SeuicEvent`): `Tag` (string EPC hex), `ExeError` (string), `GetPowerLevel` (string),
  `TriggerDown` / `TriggerUp` (int keyCode)

## หมายเหตุ

- ทุกจุดที่แตะ `com.seuic.*` จับ `Throwable` — บนมือถือรุ่นอื่นที่ไม่มี SDK นี้ การอ้างคลาสจะโยน
  `NoClassDefFoundError` ต้องไม่ให้แอป crash (guard ด้วย device-type setting เหมือน Orca)
- แอป `com.seuic.uhftool` ในตัวเครื่องรัน foreground service ค้างไว้และจับปุ่มไก `248,250` อยู่ —
  ScanKey ใช้กติกา "callback ที่ register ทีหลังสุดได้รับ" เราจึงแย่งปุ่มมาได้ตอน foreground และ
  คืนให้ตอน `onHostPause` ถ้าเจอปัญหาแย่งโมดูล UHF ให้ `adb shell pm disable-user --user 0
  com.seuic.uhftool`
