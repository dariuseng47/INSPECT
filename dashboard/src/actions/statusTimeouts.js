import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetStatusTimeouts(hospitalId) {
  const url = hospitalId
    ? `${endpoints.statusTimeouts.list}?hospitalId=${hospitalId}`
    : endpoints.statusTimeouts.list;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      statusTimeouts: data?.settings || [],
      statusTimeoutsLoading: isLoading,
      statusTimeoutsError: error,
      refreshStatusTimeouts: mutate,
    }),
    [data?.settings, error, isLoading, mutate]
  );
}

export async function updateStatusTimeouts(hospitalId, settings) {
  const url = hospitalId
    ? `${endpoints.statusTimeouts.list}?hospitalId=${hospitalId}`
    : endpoints.statusTimeouts.list;
  const { data } = await axios.put(url, { settings });
  return data;
}
