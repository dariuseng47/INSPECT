import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetScanBatches() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.scans.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      batches: data?.batches || [],
      batchesLoading: isLoading,
      batchesError: error,
      batchesEmpty: !isLoading && !data?.batches?.length,
      refreshBatches: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export function useGetScanBatch(id) {
  const { data, isLoading, error } = useSWR(id ? endpoints.scans.details(id) : null, fetcher, swrOptions);

  return useMemo(
    () => ({
      batch: data?.batch || null,
      items: data?.items || [],
      summary: data?.summary || null,
      batchLoading: isLoading,
      batchError: error,
    }),
    [data, error, isLoading]
  );
}

export async function createScan(file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await axios.post(endpoints.scans.list, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
