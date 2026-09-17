import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetGlobalSettings() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.globalSettings.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      settings: data?.settings,
      settingsLoading: isLoading,
      settingsError: error,
      refreshSettings: mutate,
    }),
    [data?.settings, error, isLoading, mutate]
  );
}

export async function updateGlobalSettings(payload) {
  const { data } = await axios.put(endpoints.globalSettings.list, payload);
  return data;
}
