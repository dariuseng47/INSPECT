'use client';

import Chip from '@mui/material/Chip';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// แสดงชื่อโรงพยาบาลที่หน้านี้กำลังแสดงข้อมูลอยู่ — ไม่ต้องส่ง prop อะไรเลย ดึงเองจาก
// useEffectiveHospital() + useAuthContext() ใช้แทนที่ <HospitalSelector> เดิมที่เคยอยู่ในทุกหน้า
// (การสลับโรงพยาบาลย้ายไปอยู่ที่ sidebar switcher ด้านบนแล้ว หน้านี้แค่บอกว่ากำลังดู รพ. ไหนอยู่)
export function HospitalContextChip({ sx, ...other }) {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();

  const hospitalName = isSuperadmin
    ? hospitals.find((hospital) => hospital.id === hospitalId)?.name
    : user?.hospital_name;

  if (!hospitalName) return null;

  return (
    <Chip
      variant="soft"
      color="primary"
      icon={<Iconify icon="solar:hospital-bold-duotone" width={20} />}
      label={hospitalName}
      sx={{
        height: 34,
        fontWeight: 700,
        fontSize: 14,
        px: 0.5,
        // เป็น child ตรงของ DashboardContent (flex column) เสมอ ถ้าไม่ล็อก alignSelf
        // จะถูกยืดเต็มความกว้างตาม align-items: stretch ที่เป็นค่า default ของ flex container
        alignSelf: 'flex-start',
        '& .MuiChip-icon': { ml: 1 },
        ...sx,
      }}
      {...other}
    />
  );
}
