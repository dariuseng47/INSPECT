import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetTransfers() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.transfers.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      transfers: data?.transfers || [],
      transfersLoading: isLoading,
      transfersError: error,
      transfersEmpty: !isLoading && !data?.transfers.length,
      refreshTransfers: mutate,
    }),
    [data?.transfers, error, isLoading, mutate]
  );
}

export async function createTransfer(payload) {
  const { data } = await axios.post(endpoints.transfers.list, payload);
  return data;
}
