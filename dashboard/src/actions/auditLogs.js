import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// hospitalId ไม่ส่ง = ไม่กรอง (superadmin เห็นทุก tenant, admin ถูกบังคับ tenant ตัวเองจาก backend อยู่แล้ว)
export function useGetAuditLogs({ hospitalId, action, limit } = {}) {
  const params = new URLSearchParams();
  if (hospitalId) params.set('hospitalId', hospitalId);
  if (action) params.set('action', action);
  if (limit) params.set('limit', limit);

  const query = params.toString();
  const url = query ? `${endpoints.auditLogs.list}?${query}` : endpoints.auditLogs.list;

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      auditLogs: data?.auditLogs || [],
      auditLogsLoading: isLoading,
      auditLogsError: error,
      auditLogsValidating: isValidating,
      auditLogsEmpty: !isLoading && !data?.auditLogs.length,
      refreshAuditLogs: mutate,
    }),
    [data?.auditLogs, error, isLoading, isValidating, mutate]
  );
}
