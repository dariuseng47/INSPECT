import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetStockScanRounds(hospitalId) {
  const url = hospitalId ? [endpoints.scans.stockScanRounds, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      rounds: data?.rounds ?? [],
      roundsLoading: isLoading,
      roundsError: error,
      refreshRounds: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
