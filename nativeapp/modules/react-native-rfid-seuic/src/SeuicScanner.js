import { NativeModules, DeviceEventEmitter } from 'react-native';
import { SeuicEvent } from './SeuicEvent';

// Bridge ไป UHF module + ปุ่มไกในตัวเครื่อง SEUIC AUTOID UTouch 2 ผ่าน system SDK
// (com.seuic.uhf.UHFService / com.seuic.scankey.ScanKeyService) — API เลียนแบบ OrcaScanner
// ให้มากที่สุด เพื่อให้ src/rfid/drivers.js สลับสองเครื่องได้โดยแทบไม่ต้องแยกโค้ด
//
// ต่างจาก Orca 50:
//  - ไม่ต้อง bundle .so — ไลบรารี native อยู่ใน ROM ของเครื่อง (system server com.seuic.uhfserver)
//  - มี event ปุ่มไกจริง (TriggerDown / TriggerUp จาก scancode 250) — Orca ไม่มี
//  - รับแท็กผ่าน push callback (registerReadTags) ฝั่ง native แล้วยิงเป็น TagEvent ทีละตัว

const { RNRfidSeuic } = NativeModules;
let instance = null;

class RNRfidSeuicScanner {
  constructor() {
    if (instance) return instance;
    instance = this;
    this.oncallbacks = {};

    DeviceEventEmitter.addListener(SeuicEvent.Tag, this.dispatch(SeuicEvent.Tag));
    DeviceEventEmitter.addListener(SeuicEvent.ExeError, this.dispatch(SeuicEvent.ExeError));
    DeviceEventEmitter.addListener(SeuicEvent.GetPowerLevel, this.dispatch(SeuicEvent.GetPowerLevel));
    DeviceEventEmitter.addListener(SeuicEvent.TriggerDown, this.dispatch(SeuicEvent.TriggerDown));
    DeviceEventEmitter.addListener(SeuicEvent.TriggerUp, this.dispatch(SeuicEvent.TriggerUp));
  }

  dispatch = (event) => (payload) => {
    const cb = this.oncallbacks[event];
    if (cb) cb(payload);
  };

  // one listener ต่อ event เหมือน OrcaScanner — พอสำหรับ use case นี้ (Tag / TriggerDown / TriggerUp
  // แยกชื่อกันอยู่แล้ว) ผู้เรียกที่ต้องการเปลี่ยน callback ให้ on() ทับได้เลย
  on(event, callback) {
    this.oncallbacks[event] = callback;
  }

  removeon(event, callback) {
    if (this.oncallbacks[event] === callback || callback === undefined) {
      delete this.oncallbacks[event];
    }
  }

  connect = () =>
    new Promise((resolve) => {
      if (!RNRfidSeuic) {
        resolve(false);
        return;
      }
      RNRfidSeuic.connect((result) => resolve(!!result));
    });

  disconnect = () => {
    RNRfidSeuic?.disconnect();
  };

  isConnected = () =>
    new Promise((resolve) => {
      if (!RNRfidSeuic) {
        resolve(false);
        return;
      }
      RNRfidSeuic.isConnected((result) => resolve(!!result));
    });

  startRead() {
    RNRfidSeuic?.startRead();
  }

  stopRead() {
    RNRfidSeuic?.stopRead();
  }

  cleanTagBuffer() {
    RNRfidSeuic?.cleanTagBuffer();
  }

  setAntennaPower(level) {
    RNRfidSeuic?.setAntennaPower(String(level));
  }

  getAntennaPower() {
    RNRfidSeuic?.getAntennaPower();
  }
}

export default new RNRfidSeuicScanner();
