import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// startDate/endDate เป็นสตริง 'YYYY-MM-DD' — คุมทั้งช่วงวันที่ของ batches และสรุปยอดตามหมวดหมู่ฝั่ง server
export function useGetWashReceiveReport(hospitalId, { startDate, endDate } = {}) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
  const url = hospitalId ? [endpoints.washReceiveReport.get, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      totals: data?.totals ?? { totalBatches: 0, totalItems: 0, totalWeightKg: 0 },
      byCategory: data?.byCategory ?? [],
      batches: data?.batches ?? [],
      reportLoading: isLoading,
      reportError: error,
      refreshReport: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
