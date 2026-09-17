import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetReviewLogs() {
  const { data, isLoading, error } = useSWR(endpoints.reviewLogs.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      reviewLogs: data?.reviewLogs || [],
      reviewLogsLoading: isLoading,
      reviewLogsError: error,
    }),
    [data, error, isLoading]
  );
}
