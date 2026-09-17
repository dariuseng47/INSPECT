import { useEffect } from 'react';

import { useSearchParams } from 'src/routes/hooks';

import { useGetHospitals } from 'src/actions/hospitals';
import { useHospitalWorkspace } from 'src/contexts/hospital-workspace-context';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// admin/operator ทำงานในโรงพยาบาลตัวเองเสมอ (มี hospital_id ใน JWT อยู่แล้ว)
// superadmin ไม่มี tenant ของตัวเอง ต้องเลือกโรงพยาบาลก่อนถึงจะดูข้อมูลระดับ tenant ได้
// (ดู docs/multi-tenant-isolation.md — ห้าม default เป็น "ทุก tenant" เงียบๆ)
//
// โรงพยาบาลที่เลือกไว้เก็บใน HospitalWorkspaceContext ระดับ global (ไม่ใช่ local state
// ของหน้านี้อีกต่อไป) เพื่อให้ค่าคงอยู่ตอนสลับเมนู เปลี่ยนที่ sidebar switcher ครั้งเดียว
// ใช้ได้ทุกหน้า — ดู src/layouts/components/hospital-workspace-switcher.jsx
//
// ยังรองรับ query param ?hospitalId= อยู่ (เผื่อ superadmin คลิกเข้ามาจากหน้ารายละเอียด
// โรงพยาบาลหนึ่งแล้วอยากให้หน้าอื่น เช่น ผู้ใช้งาน/โครงสร้าง preselect โรงพยาบาลเดิมให้เลย)
// พารามิเตอร์นี้ชนะค่าที่เคยเลือกไว้เสมอเมื่อมีค่าถูกต้อง เพราะเป็นการนำทางที่ผู้ใช้ตั้งใจระบุ
export function useEffectiveHospital() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { hospitals, hospitalsLoading } = useGetHospitals(isSuperadmin);
  const { selectedHospitalId, setSelectedHospitalId } = useHospitalWorkspace();

  const hospitalIdFromUrl = searchParams.get('hospitalId');

  useEffect(() => {
    if (!isSuperadmin || hospitals.length === 0) return;

    const fromUrl = hospitalIdFromUrl ? Number(hospitalIdFromUrl) : null;
    const isValidUrlId = fromUrl && hospitals.some((h) => h.id === fromUrl);

    if (isValidUrlId && fromUrl !== selectedHospitalId) {
      setSelectedHospitalId(fromUrl);
      return;
    }

    // เผื่อค่าที่จำไว้จาก localStorage เป็นโรงพยาบาลที่ถูกลบไปแล้ว ต้องกลับไป default ใหม่
    const isCurrentSelectionValid =
      selectedHospitalId && hospitals.some((h) => h.id === selectedHospitalId);
    if (!isCurrentSelectionValid) {
      setSelectedHospitalId(hospitals[0].id);
    }
  }, [isSuperadmin, hospitals, selectedHospitalId, hospitalIdFromUrl, setSelectedHospitalId]);

  // selectedHospitalId มาจาก context+localStorage ที่เริ่มต้นเป็น '' แล้วค่อยถูกเซ็ตใน useEffect
  // ด้านบน — มีช่วง render ที่ค่ายังว่างทั้งที่ hospitals โหลดเสร็จแล้ว ทำให้ปุ่มบางจุด (หรือ submit
  // ด้วย Enter) ยิง action ออกไปโดยไม่มี hospitalId -> backend เด้ง "superadmin ต้องระบุ hospitalId เสมอ"
  // กันด้วยการ fallback ไปโรงพยาบาลแรกแบบ sync ตรงนี้เลย ไม่รอ effect (effect ยังทำหน้าที่ persist ค่าอยู่)
  const superadminHospitalId =
    selectedHospitalId && hospitals.some((h) => h.id === selectedHospitalId)
      ? selectedHospitalId
      : (hospitals[0]?.id ?? null);

  const hospitalId = isSuperadmin ? superadminHospitalId : user?.hospital_id;

  return {
    hospitalId,
    isSuperadmin,
    hospitals,
    hospitalsLoading,
    selectedHospitalId,
    setSelectedHospitalId,
  };
}
