import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetLocationByEpc(epcCode, hospitalId) {
  const url = epcCode
    ? [endpoints.tracking.location(epcCode), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      fabricItem: data?.fabricItem,
      location: data?.location,
      lastScan: data?.lastScan,
      locationLoading: isLoading,
      locationError: error,
      refreshLocation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// โพลทุก 15 วิเป็น fallback เผื่อ socket หลุด/พลาด event — ตัว
// OperationsProcessMonitorView เองต่อ useSocketEvent ไว้รีเฟรชทันทีอยู่แล้วด้วย
export function useGetProcessStatus(hospitalId) {
  const url = hospitalId ? [endpoints.tracking.processStatus, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 15000,
  });

  return useMemo(
    () => ({
      statusCounts: data?.statusCounts || [],
      stuckItems: data?.stuckItems || [],
      processStatusLoading: isLoading,
      processStatusError: error,
      refreshProcessStatus: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
