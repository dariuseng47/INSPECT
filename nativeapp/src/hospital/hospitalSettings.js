import * as SecureStore from 'expo-secure-store';

// จำ "โรงพยาบาลที่ superadmin เลือกจัดการ" ไว้ในเครื่อง (แพทเทิร์นเดียวกับ src/rfid/deviceSettings.js)
// เพื่อให้เปิดแอปครั้งถัดไปยังอยู่ที่โรงพยาบาลเดิม ไม่ต้องเลือกใหม่ทุกครั้ง
const STORAGE_KEY = 'welgroup_managed_hospital';

export async function getStoredHospitalId() {
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setStoredHospitalId(hospitalId) {
  if (hospitalId == null) {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, String(hospitalId));
}
