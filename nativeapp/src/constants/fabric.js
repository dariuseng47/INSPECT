// Ported from dashboard/src/sections/fabric/fabric-constants.js — kept in sync manually
// (no shared package between the two apps) so both platforms read the same status colors.

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
