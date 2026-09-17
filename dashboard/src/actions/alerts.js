import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

// โพลทุก 30 วิเป็น fallback เผื่อ socket หลุด/พลาด event — ตัว AlertsView เองต่อ
// useSocketEvent (scan:created, device:status_changed ฯลฯ) ไว้รีเฟรชทันทีอยู่แล้วด้วย
export function useGetAlerts(hospitalId) {
  const url = hospitalId ? [endpoints.alerts.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30000,
  });

  return useMemo(
    () => ({
      statusTimeout: data?.statusTimeout || [],
      parLevel: data?.parLevel || [],
      deviceOffline: data?.deviceOffline || [],
      weakSignal: data?.weakSignal || [],
      stepSkipped: data?.stepSkipped || [],
      alertsLoading: isLoading,
      alertsError: error,
      refreshAlerts: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
