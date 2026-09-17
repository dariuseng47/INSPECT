// ลำดับชั้นบังคับ (ตรงกับ server/src/controllers/departments.controller.js):
// BUILDING (ราก) -> FLOOR (ต้องอยู่ใต้ BUILDING) -> WARD (ต้องอยู่ใต้ FLOOR)
export const LEVEL_LABEL = {
  BUILDING: 'อาคาร',
  FLOOR: 'ชั้น',
  WARD: 'วอร์ด/แผนก',
};

export const LEVEL_COLOR = {
  BUILDING: 'primary',
  FLOOR: 'info',
  WARD: 'success',
};

export const LEVEL_ICON = {
  BUILDING: 'solar:buildings-2-bold-duotone',
  FLOOR: 'solar:layers-bold-duotone',
  WARD: 'solar:hospital-bold-duotone',
};

// ระดับที่ต่ำกว่าถัดไป (ใช้ตอนกดปุ่ม "+ เพิ่มแผนกย่อย")
export const NEXT_LEVEL = { BUILDING: 'FLOOR', FLOOR: 'WARD', WARD: null };

// ระดับ parent ที่ต้องมี (ใช้ตรวจฝั่ง client ก่อนยิง request กันโดน 400 โดยไม่จำเป็น)
export const REQUIRED_PARENT_LEVEL = { FLOOR: 'BUILDING', WARD: 'FLOOR' };

export function buildDepartmentTree(flatList) {
  const nodeMap = new Map(flatList.map((d) => [d.id, { ...d, children: [] }]));
  const roots = [];

  flatList.forEach((d) => {
    const node = nodeMap.get(d.id);
    if (d.parent_id && nodeMap.has(d.parent_id)) {
      nodeMap.get(d.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const bySortOrder = (a, b) => a.sort_order - b.sort_order;
  nodeMap.forEach((node) => node.children.sort(bySortOrder));
  roots.sort(bySortOrder);

  return roots;
}
