import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

// โพลทุก 15 วิ — เบาพอสำหรับ top bar widget ไม่ต้อง realtime แบบ socket
const swrOptions = {
  refreshInterval: 15000,
  revalidateOnFocus: false,
};

export function useMlHealth() {
  const { data, isLoading } = useSWR(endpoints.mlHealth.get, fetcher, swrOptions);

  return useMemo(
    () => ({
      health: data || null,
      healthLoading: isLoading,
      reachable: data?.reachable ?? false,
    }),
    [data, isLoading]
  );
}
