import OrcaScanner, { OrcaEvent } from 'react-native-rfid-orca50';
import SeuicScanner, { SeuicEvent } from 'react-native-rfid-seuic';

import { SEUIC_AUTOID_UTOUCH_2 } from './deviceSettings';

// เลือก "driver" ของเครื่องอ่านตาม device id ที่ผู้ใช้ตั้งไว้ — คืน scanner singleton (API เหมือนกัน
// ทั้งคู่: connect/disconnect/isConnected/on/removeon/startRead/stopRead/cleanTagBuffer/
// setAntennaPower/getAntennaPower) + ตารางชื่อ event + ธงบอกว่าเครื่องนี้ให้ event ปุ่มไกจริงไหม
//
//  - Orca 50: ปุ่มไกทำงานที่ firmware (setTrigger(true)) แท็กไหลเข้ามาเองระหว่างเหนี่ยวไก —
//    ไม่มี event บอกว่ากด/ปล่อย ต้องเดาเอาจาก debounce หลังแท็กตัวสุดท้าย
//  - SEUIC UTouch 2: มี TriggerDown/TriggerUp จริง (scancode 250) → useTriggerScan สั่ง
//    startRead()/stopRead() รอบ ๆ เอง
const DRIVERS = {
  [SEUIC_AUTOID_UTOUCH_2]: {
    scanner: SeuicScanner,
    event: SeuicEvent,
    hasTriggerEvents: true,
  },
  __orca__: {
    scanner: OrcaScanner,
    event: OrcaEvent,
    hasTriggerEvents: false,
  },
};

export function getDriver(deviceId) {
  return DRIVERS[deviceId] || DRIVERS.__orca__;
}
