import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetDecommissionRequests(hospitalId, status = 'PENDING') {
  const params = { status, ...(hospitalId ? { hospitalId } : {}) };
  const url = [endpoints.decommissionRequests.list, { params }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      requests: data?.requests || [],
      requestsLoading: isLoading,
      requestsError: error,
      requestsEmpty: !isLoading && !data?.requests?.length,
      refreshRequests: mutate,
    }),
    [data?.requests, error, isLoading, mutate]
  );
}

export async function approveDecommissionRequest(id) {
  const { data } = await axios.post(endpoints.decommissionRequests.approve(id));
  return data;
}

export async function rejectDecommissionRequest(id, payload) {
  const { data } = await axios.post(endpoints.decommissionRequests.reject(id), payload);
  return data;
}
