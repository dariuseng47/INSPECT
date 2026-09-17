'use client';

import { useMemo, useContext, createContext } from 'react';

import { useLocalStorage } from 'src/hooks/use-local-storage';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'lms-selected-hospital-id';

const HospitalWorkspaceContext = createContext(undefined);

// เก็บ "โรงพยาบาลที่ superadmin กำลังดูอยู่" ไว้ระดับ global (ไม่ใช่ local state ในแต่ละหน้า)
// เพื่อให้ค่าที่เลือกไว้คงอยู่ตอนสลับเมนู ไม่ต้องเลือกใหม่ทุกครั้ง — ตามที่ผู้ใช้แจ้งว่ายากไป
// และจำค่าไว้ข้าม session ด้วย localStorage (ปิดเบราว์เซอร์แล้วเปิดใหม่ยังอยู่ที่ รพ. เดิม)
export function HospitalWorkspaceProvider({ children }) {
  const { state: selectedHospitalId, setState: setSelectedHospitalId } = useLocalStorage(
    STORAGE_KEY,
    ''
  );

  const memoizedValue = useMemo(
    () => ({ selectedHospitalId, setSelectedHospitalId }),
    [selectedHospitalId, setSelectedHospitalId]
  );

  return (
    <HospitalWorkspaceContext.Provider value={memoizedValue}>
      {children}
    </HospitalWorkspaceContext.Provider>
  );
}

export function useHospitalWorkspace() {
  const context = useContext(HospitalWorkspaceContext);
  if (context === undefined) {
    throw new Error('useHospitalWorkspace ต้องถูกใช้ภายใน HospitalWorkspaceProvider เท่านั้น');
  }
  return context;
}
