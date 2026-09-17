import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetWashAnalytics(hospitalId) {
  const url = hospitalId ? [endpoints.washAnalytics.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      categorySummary: data?.categorySummary || [],
      topWornItems: data?.topWornItems || [],
      washAnalyticsLoading: isLoading,
      washAnalyticsError: error,
      refreshWashAnalytics: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
