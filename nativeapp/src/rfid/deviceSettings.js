import * as SecureStore from 'expo-secure-store';

// Registry ของเครื่องอ่าน RFID ที่รองรับ — ทั้งคู่เป็น Android handheld ที่มี UHF module ในตัว
// เครื่อง (ไม่ใช่ Bluetooth sled แยก) เพิ่มรุ่นต่อไปในนี้ได้ พร้อมช่วง power ของรุ่นนั้น
export const RODINBELL_ORCA_50 = 'RODINBELL_ORCA_50';
export const SEUIC_AUTOID_UTOUCH_2 = 'SEUIC_AUTOID_UTOUCH_2';

// power = กำลังส่งเสาอากาศ (dBm) ยิ่งสูงยิ่งอ่านไกล/ไว แต่กินไฟ+ร้อนกว่า ช่วงต่างกันตามฮาร์ดแวร์
//  - Orca 50: 5–30 (ค่า default สูงสุดไว้เพราะหน้างานบ่นสัญญาณอ่อน)
//  - SEUIC UTouch 2: 1–33 (หน้างานยืนยัน 30 อ่านกองผ้าครบ)
export const RFID_DEVICES = [
  { id: RODINBELL_ORCA_50, label: 'Rodinbell Orca 50', power: { min: 5, max: 30, default: 30 } },
  { id: SEUIC_AUTOID_UTOUCH_2, label: 'SEUIC AUTOID UTouch 2', power: { min: 1, max: 33, default: 30 } },
];

const NONE_DEVICE_ID = 'NONE';
const STORAGE_KEY = 'welgroup_rfid_device';
const POWER_STORAGE_KEY = 'welgroup_rfid_power';

const WIDEST_POWER = { min: 1, max: 33, default: 30 };

export function getPowerRange(deviceId) {
  const device = RFID_DEVICES.find((d) => d.id === deviceId);
  return device ? device.power : WIDEST_POWER;
}

// เผื่อมีที่ไหนยัง import READER_POWER อยู่ — ให้เป็นช่วงของ Orca 50 (เครื่องแรก) ไว้ก่อน
export const READER_POWER = RFID_DEVICES[0].power;

function clampPower(level, range = WIDEST_POWER) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return range.default;
  return Math.min(range.max, Math.max(range.min, n));
}

export async function getSelectedDeviceId() {
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  return value || NONE_DEVICE_ID;
}

export async function setSelectedDeviceId(deviceId) {
  if (!deviceId || deviceId === NONE_DEVICE_ID) {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, deviceId);
}

// power เก็บ key เดียวใช้ร่วมทุกเครื่อง — clamp เข้าช่วงของเครื่องที่กำลังเลือกตอนอ่าน/เขียน
// เผื่อสลับเครื่องแล้วค่าเดิมหลุดช่วง
export async function getReaderPower(deviceId) {
  const range = getPowerRange(deviceId);
  const value = await SecureStore.getItemAsync(POWER_STORAGE_KEY);
  return value ? clampPower(value, range) : range.default;
}

export async function setReaderPower(level, deviceId) {
  const clamped = clampPower(level, getPowerRange(deviceId));
  await SecureStore.setItemAsync(POWER_STORAGE_KEY, String(clamped));
  return clamped;
}

export { NONE_DEVICE_ID };
