// ชื่อ DeviceEventEmitter event ที่ฝั่ง native (RNRfidSeuicModule) ยิงขึ้นมา — ตั้งให้พ้องกับ
// OrcaEvent เท่าที่มีร่วมกันได้ (Tag/ExeError/GetPowerLevel) เพื่อให้ driver layer สลับใช้ได้
// โดยไม่ต้อง map ชื่อ ส่วน TriggerDown/TriggerUp เป็นของ SEUIC โดยเฉพาะ — Orca ไม่มี trigger
// event จริง (อาศัย firmware + เดาเอาจาก debounce)
export const SeuicEvent = {
  Tag: 'TagEvent',
  ExeError: 'HandleError',
  GetPowerLevel: 'getPowerLevel',
  TriggerDown: 'TriggerDown',
  TriggerUp: 'TriggerUp',
};
