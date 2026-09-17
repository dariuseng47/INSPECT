import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// enabled=false ข้าม fetch ไปเลย (เช่น admin/operator ที่ไม่มีสิทธิ์เรียก GET /hospitals
// ซึ่งเป็น superadmin-only — ดู server/src/routes/hospitals.routes.js)
export function useGetHospitals(enabled = true) {
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    enabled ? endpoints.hospitals.list : null,
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => ({
      hospitals: data?.hospitals || [],
      hospitalsLoading: isLoading,
      hospitalsError: error,
      hospitalsValidating: isValidating,
      hospitalsEmpty: !isLoading && !data?.hospitals.length,
      refreshHospitals: mutate,
    }),
    [data?.hospitals, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export async function createHospital(payload) {
  const { data } = await axios.post(endpoints.hospitals.list, payload);
  return data;
}

export async function updateHospital(id, payload) {
  const { data } = await axios.patch(endpoints.hospitals.details(id), payload);
  return data;
}

export async function deleteHospital(id) {
  await axios.delete(endpoints.hospitals.details(id));
}

// สรุปข้อมูลรวมข้ามทุกโรงพยาบาล — ใช้ทำ Super Dashboard (superadmin เท่านั้น)
export function useGetHospitalsSummary(enabled = true) {
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? endpoints.hospitals.summary : null,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      hospitalsSummary: data?.hospitals || [],
      totals: data?.totals,
      hospitalsSummaryLoading: isLoading,
      hospitalsSummaryError: error,
      refreshHospitalsSummary: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export function useDashboardSummary(hospitalId) {
  const url = hospitalId ? endpoints.hospitals.dashboardSummary(hospitalId) : '';

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, swrOptions);

  const memoizedValue = useMemo(
    () => ({
      summary: data,
      summaryLoading: isLoading,
      summaryError: error,
      summaryValidating: isValidating,
      refreshSummary: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
