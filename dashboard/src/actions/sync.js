import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// hospitalId ไม่ส่ง = ไม่กรอง (superadmin เห็นทุก tenant, admin ถูกบังคับ tenant ตัวเองจาก backend อยู่แล้ว)
export function useGetSyncConflicts(hospitalId) {
  const url = hospitalId
    ? [endpoints.sync.conflicts, { params: { hospitalId } }]
    : endpoints.sync.conflicts;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      conflicts: data?.conflicts || [],
      conflictsLoading: isLoading,
      conflictsError: error,
      conflictsEmpty: !isLoading && !data?.conflicts.length,
      refreshConflicts: mutate,
    }),
    [data?.conflicts, error, isLoading, mutate]
  );
}

export async function approveSyncConflict(id, chosen) {
  await axios.post(endpoints.sync.approve(id), { chosen });
}
