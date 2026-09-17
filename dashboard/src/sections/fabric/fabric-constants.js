// ค่าคงที่ใช้ร่วมกันในหน้า Fabric & Lot Management ทั้งหมด — ตรงกับ ENUM status ใน docs/data-model.md

// สถานะผ้ายุบเหลือ lifecycle 4 สถานะ + exception state — ดู server/db/migrations/023_consolidate_fabric_statuses.sql
export const STATUS_LABEL = {
  WASH: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า',
  CENTRAL_STOCK: 'สต๊อกกลาง',
  WARD_CABINET: 'ตู้แผนก',
  IN_USE_WARD: 'ใช้งานที่วอร์ด',
  HOLD: 'พักใช้งาน',
  DECOMMISSIONED: 'แทงชำรุด',
  PENDING_DECOMMISSION: 'รออนุมัติแทงชำรุด',
};

export const STATUS_COLOR = {
  WASH: 'info',
  CENTRAL_STOCK: 'primary',
  WARD_CABINET: 'success',
  IN_USE_WARD: 'success',
  HOLD: 'warning',
  DECOMMISSIONED: 'error',
  PENDING_DECOMMISSION: 'warning',
};

export const FABRIC_STATUSES = Object.keys(STATUS_LABEL);

// สถานะที่เมนู "เปลี่ยนสถานะผ้า" (POST /scans/status-change) รับเป็น from/to ได้ — ต้องตรงกับ
// STATUS_CHANGE_STATUSES ใน server/src/schemas/scans.schema.js (ไม่รวม HOLD/แทงชำรุด ที่มี flow แยก)
export const MANUAL_STATUS_CHANGE_STATUSES = [
  'WASH',
  'CENTRAL_STOCK',
  'WARD_CABINET',
  'IN_USE_WARD',
];

// ล๊อคขนาดไฟล์รูปพัก/ชำรุดไม่เกิน 2MB — ต้องตรงกับ MAX_FILE_SIZE_BYTES ฝั่ง
// server/src/middleware/upload.js (backend เป็นด่านบังคับจริง อันนี้แค่กันผู้ใช้เห็น error เร็วขึ้น)
export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

export const REASON_CODE_OPTIONS = [
  { value: 'DAMAGED_TORN', label: 'ผ้าขาด/รอยฉีก' },
  { value: 'STAINED_UNREMOVABLE', label: 'คราบไม่ออก' },
  { value: 'LOST_TAG', label: 'RFID Tag หลุด/เสีย' },
  { value: 'QUALITY_ISSUE', label: 'คุณภาพผ้าเสื่อม' },
  { value: 'OTHER', label: 'อื่นๆ' },
];
