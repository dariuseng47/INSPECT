import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// แผน "จัดผ้าเข้ารถ" — วิเคราะห์ทุกตู้ผ้าว่าต้องเติมผ้าหมวดหมู่ใดกี่ชิ้น + สรุปรวมทั้งโรงพยาบาล
// (ดู server/src/controllers/restockCartPlan.controller.js)
export function useGetRestockCartPlan(hospitalId) {
  const url = hospitalId ? [endpoints.restockCartPlan.get, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      generatedAt: data?.generatedAt,
      cabinets: data?.cabinets ?? [],
      summary: data?.summary ?? [],
      totals: data?.totals ?? {
        cabinetCount: 0,
        cabinetsNeedingRestock: 0,
        categoryCount: 0,
        totalSuggestedLoad: 0,
      },
      cartPlanLoading: isLoading,
      cartPlanError: error,
      refreshCartPlan: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
