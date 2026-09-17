import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// startDate/endDate เป็นสตริง 'YYYY-MM-DD' — กรอง history/summaryByWard เท่านั้น
// (dailyChart/forecast ฝั่ง server ใช้ 30 วันล่าสุดเสมอ ไม่ผูกกับตัวกรองนี้)
export function useGetRestockReport(hospitalId, { startDate, endDate } = {}) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
  const url = hospitalId ? [endpoints.restockReport.get, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      totals: data?.totals ?? { totalEvents: 0, totalTransfers: 0, totalRounds: 0 },
      history: data?.history ?? [],
      summaryByWard: data?.summaryByWard ?? [],
      summaryByBuilding: data?.summaryByBuilding ?? [],
      rounds: data?.rounds ?? [],
      dailyChart: data?.dailyChart ?? { days: [], series: [] },
      forecast: data?.forecast ?? [],
      reportLoading: isLoading,
      reportError: error,
      refreshReport: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// startDateTime/endDateTime เป็นสตริง 'YYYY-MM-DD HH:mm' — ใช้แท็บ "ประวัติยอดการเติมผ้า" ที่กรอง
// ละเอียดถึงระดับชั่วโมง/นาที คนละตัวกรองกับ useGetRestockReport ด้านบน (ซึ่งกรองแค่ระดับวัน)
export function useGetRestockFillHistory(
  hospitalId,
  { startDateTime, endDateTime, buildingId, wardIds } = {}
) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDateTime ? { startDateTime } : {}),
    ...(endDateTime ? { endDateTime } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(wardIds && wardIds.length > 0 ? { wardIds: wardIds.join(',') } : {}),
  };
  const url = hospitalId ? [endpoints.restockReport.fillHistory, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      days: data?.days ?? [],
      wards: data?.wards ?? [],
      categories: data?.categories ?? [],
      fillHistoryLoading: isLoading,
      fillHistoryError: error,
      refreshFillHistory: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
