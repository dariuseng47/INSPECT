import { paths } from 'src/routes/paths';

// "ศูนย์บริหารเครือข่าย" (HQ) เป็นเมนูเดียวในระบบที่ "ไม่" ผูกกับโรงพยาบาลที่เลือกไว้ (มองข้าม tenant
// ได้ทั้งเครือข่าย — เห็นเฉพาะ superadmin) จึงแยกออกมาแสดง "เหนือ" ตัวเลือกโรงพยาบาลใน sidebar
// เพื่อสื่อสารด้วย layout เองว่าเมนูใต้ตัวเลือกลงไปทั้งหมดอิงกับโรงพยาบาลที่เลือกอยู่ ส่วนเมนูนี้ไม่อิง
// ใช้ path เทียบแทน title เพราะเป็นค่าคงที่ระดับโค้ด ไม่ใช่ label ที่แปลภาษาได้และอาจเปลี่ยนได้ในอนาคต
// (path ของเมนูนี้คือ root เพราะเมนูย่อยแรก "ภาพรวมการทำงาน" ชี้ไปที่ root)
const HQ_ITEM_PATH = paths.dashboard.root;

// แยก data (array ของ { subheader, items }) ออกเป็น 2 ชุด: hqData (เมนู HQ อย่างเดียว ถ้ามี —
// ไม่มีเลยสำหรับ admin/operator เพราะถูกกรองออกจาก getNavData() ไปแล้วตาม role) และ restData
// (ทุกเมนูที่เหลือ คงโครงสร้าง subheader เดิมไว้ทั้งหมด)
export function splitNavDataByHqSection(data) {
  let hqItem = null;

  const restData = data.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.path === HQ_ITEM_PATH) {
        hqItem = item;
        return false;
      }
      return true;
    }),
  }));

  const hqData = hqItem ? [{ subheader: 'จัดการภาพรวม', items: [hqItem] }] : [];

  return { hqData, restData };
}
