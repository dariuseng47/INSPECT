import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export async function triggerScanSession(payload) {
  const { data } = await axios.post(endpoints.scanSessions.list, payload);
  return data;
}

// โพลทุก 3 วิระหว่างที่ session ยังไม่จบ (PENDING/SCANNING/REPORTED) — รอวันที่มี real-time
// socket subscription ฝั่ง dashboard ค่อยเปลี่ยนมาใช้ event แทนการโพล
export function useGetScanSession(sessionId, hospitalId) {
  const url = sessionId
    ? [endpoints.scanSessions.details(sessionId), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latestData) =>
      latestData?.session && ['CONFIRMED', 'CANCELLED'].includes(latestData.session.status)
        ? 0
        : 3000,
  });

  return useMemo(
    () => ({
      session: data?.session,
      sessionLoading: isLoading,
      sessionError: error,
      refreshSession: mutate,
    }),
    [data?.session, error, isLoading, mutate]
  );
}

// รายการ session ที่ยังค้าง (PENDING/SCANNING/REPORTED) — ให้แอดมินเห็น session ที่ trigger มา
// จากเครื่อง handheld เอง (ไม่ได้กด trigger จากการ์ดนี้) แล้วกดยืนยันได้ ไม่งั้นผ้าที่สแกนมาจะ
// ค้างสถานะ REPORTED ไม่เข้าคลังผ้า โพลทุก 5 วิ รอวันมี socket subscription ค่อยเปลี่ยน
export function useGetScanSessions(hospitalId) {
  // superadmin ต้องเลือกโรงพยาบาลก่อน (resolveTenantId บังคับ ?hospitalId=) — ยังไม่รู้ก็อย่ายิง
  const url = hospitalId ? [endpoints.scanSessions.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 5000,
  });

  return useMemo(
    () => ({
      sessions: data?.sessions ?? [],
      sessionsLoading: isLoading,
      sessionsError: error,
      refreshSessions: mutate,
    }),
    [data?.sessions, error, isLoading, mutate]
  );
}

export async function confirmScanSession(id, payload = {}) {
  const { data } = await axios.post(endpoints.scanSessions.confirm(id), payload);
  return data;
}

export async function cancelScanSession(id) {
  await axios.post(endpoints.scanSessions.cancel(id));
}
