import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetAuditLogs({ action, limit } = {}) {
  const params = new URLSearchParams();
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
