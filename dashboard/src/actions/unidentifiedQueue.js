import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetQueue(status) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  const url = query ? `${endpoints.unidentifiedQueue.list}?${query}` : endpoints.unidentifiedQueue.list;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      items: data?.items || [],
      queueLoading: isLoading,
      queueError: error,
      queueEmpty: !isLoading && !data?.items?.length,
      refreshQueue: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export async function addExtraImages(id, files) {
  const form = new FormData();
  [...files].forEach((file) => form.append('images', file));
  const { data } = await axios.post(endpoints.unidentifiedQueue.extraImages(id), form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function resolveQueueItem(id, payload) {
  const { data } = await axios.put(endpoints.unidentifiedQueue.resolve(id), payload);
  return data;
}

export async function rejectQueueItem(id, payload) {
  await axios.put(endpoints.unidentifiedQueue.reject(id), payload ?? {});
}
