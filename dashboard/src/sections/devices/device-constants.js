export const DEVICE_TYPES = [
  'WEIGHT_GATE',
  'FOLDING_TABLE',
  'WARD_KIOSK',
  'HANDHELD',
  'RFID_CHECKPOINT',
];

export const DEVICE_TYPE_LABEL = {
  WEIGHT_GATE: 'ประตูชั่งน้ำหนัก',
  FOLDING_TABLE: 'โต๊ะพับผ้า',
  WARD_KIOSK: 'ตู้ Kiosk ประจำวอร์ด',
  HANDHELD: 'เครื่องสแกนมือถือ (Handheld)',
  RFID_CHECKPOINT: 'เครื่องอ่าน RFID ที่จุดตรวจสอบ',
};

export const DEVICE_TYPE_ICON = {
  WEIGHT_GATE: 'solar:scale-bold-duotone',
  FOLDING_TABLE: 'solar:t-shirt-bold-duotone',
  WARD_KIOSK: 'solar:monitor-bold-duotone',
  HANDHELD: 'solar:smartphone-bold-duotone',
  RFID_CHECKPOINT: 'solar:wi-fi-router-bold-duotone',
};

// ----------------------------------------------------------------------
// จุดสแกนหน้างานที่ตั้ง "เครื่องเริ่มต้น (default)" ได้ — หน้างานที่มี dropdown เลือกเครื่องอ่าน
// จะเลือกอุปกรณ์ที่ตั้งเป็น default ของจุดนั้นให้อัตโนมัติ (ผู้ใช้เปลี่ยนเองได้)
// ค่าเหล่านี้ต้องตรงกับ server/src/schemas/device.schema.js (SCAN_POINTS)

export const SCAN_POINTS = [
  'WASH_RECEIVE',
  'STOCK_SCAN',
  'FABRIC_REGISTER',
  'FABRIC_REGISTER_HANDHELD',
];

export const SCAN_POINT_LABEL = {
  WASH_RECEIVE: 'รับผ้าหลังซัก — สแกน + ชั่งน้ำหนัก',
  STOCK_SCAN: 'สแกนเข้าสต๊อคกลาง',
  FABRIC_REGISTER: 'ลงทะเบียนผ้าใหม่ — จุดตรวจสอบ',
  FABRIC_REGISTER_HANDHELD: 'ลงทะเบียนผ้าใหม่ — Handheld',
};

// จุดสแกน -> ประเภทอุปกรณ์ที่เป็น default ของจุดนั้นได้
export const SCAN_POINT_DEVICE_TYPE = {
  WASH_RECEIVE: 'WEIGHT_GATE',
  STOCK_SCAN: 'RFID_CHECKPOINT',
  FABRIC_REGISTER: 'RFID_CHECKPOINT',
  FABRIC_REGISTER_HANDHELD: 'HANDHELD',
};
