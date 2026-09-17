import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setHospitalScope } from '../api/client';
import { fetchHospitals, fetchMyHospitals } from '../api/hospitals.api';
import { useAuth } from '../auth/AuthContext';
import { getStoredHospitalId, setStoredHospitalId } from './hospitalSettings';

// โรงพยาบาลที่บัญชีทำงานอยู่ — เก็บระดับ global ที่นี่ + จำข้าม session ผ่าน SecureStore แล้ว push
// ค่าลง apiClient ให้แนบ ?hospitalId= ไปกับทุก request (ดู docs/multi-tenant-isolation.md)
//   - superadmin: เลือกจาก /hospitals (ทุกแห่ง) ต้องเลือกก่อนถึงเรียกข้อมูล tenant ได้
//   - admin/operator: เลือกจาก /users/me/hospitals (เฉพาะที่อยู่ใน scope) — 1 แห่งไม่ต้องเลือก,
//     หลายแห่งมีตัวสลับให้เหมือน superadmin
const HospitalWorkspaceContext = createContext(null);

export function HospitalWorkspaceProvider({ children }) {
  const { status, user } = useAuth();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  // ready = พร้อมให้หน้าอื่นเริ่มยิง request ได้ (ต้องรู้ hospitalId ก่อน ไม่งั้น request แรกๆ
  // ของ superadmin จะโดน server ตีกลับว่า "ต้องระบุ hospitalId")
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === 'booting') return undefined;

    if (status !== 'signedIn') {
      setHospitalScope(null);
      setHospitals([]);
      setHospitalIdState(null);
      setLoading(false);
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setReady(false);

    (async () => {
      const [stored, res] = await Promise.all([
        getStoredHospitalId(),
        (isSuperadmin ? fetchHospitals() : fetchMyHospitals()).catch(() => ({ hospitals: [] })),
      ]);
      if (cancelled) return;

      const list = res.hospitals || [];
      setHospitals(list);

      // ค่าที่จำไว้อาจเป็นโรงพยาบาลที่หลุด scope/ถูกลบไปแล้ว — default เป็นตัวแรกในรายการ
      const isStoredValid = stored != null && list.some((h) => h.id === stored);
      const next = isStoredValid ? stored : list[0]?.id ?? null;

      setHospitalIdState(next);
      setHospitalScope(next);
      if (next !== stored) await setStoredHospitalId(next);

      setLoading(false);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, isSuperadmin]);

  const selectHospital = useCallback(async (id) => {
    setHospitalIdState(id);
    setHospitalScope(id);
    await setStoredHospitalId(id);
  }, []);

  const activeHospital = useMemo(
    () => hospitals.find((h) => h.id === hospitalId) || null,
    [hospitals, hospitalId]
  );

  // มีโรงพยาบาลให้สลับมากกว่า 1 แห่ง — ใช้ตัดสินใจว่าจะโชว์ตัวสลับโรงพยาบาลไหม
  // (superadmin โชว์เสมอ, admin/operator โชว์เมื่อ scope > 1 แห่ง)
  const canSwitch = isSuperadmin || hospitals.length > 1;

  const value = useMemo(
    () => ({
      isSuperadmin,
      canSwitch,
      hospitals,
      hospitalId,
      activeHospital,
      loading,
      ready,
      selectHospital,
    }),
    [isSuperadmin, canSwitch, hospitals, hospitalId, activeHospital, loading, ready, selectHospital]
  );

  return (
    <HospitalWorkspaceContext.Provider value={value}>{children}</HospitalWorkspaceContext.Provider>
  );
}

export function useHospitalWorkspace() {
  const ctx = useContext(HospitalWorkspaceContext);
  if (!ctx) throw new Error('useHospitalWorkspace must be used within HospitalWorkspaceProvider');
  return ctx;
}
