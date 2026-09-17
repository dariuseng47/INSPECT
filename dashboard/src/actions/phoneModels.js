import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetPhoneModels({ brand, search } = {}) {
  const params = new URLSearchParams();
  if (brand) params.set('brand', brand);
  if (search) params.set('search', search);
  const query = params.toString();
  const url = query ? `${endpoints.phoneModels.list}?${query}` : endpoints.phoneModels.list;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      models: data?.models || [],
      advice: data?.advice || '',
      modelsLoading: isLoading,
      modelsError: error,
      modelsEmpty: !isLoading && !data?.models?.length,
      refreshModels: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export function useGetPhoneModel(id) {
  const { data, isLoading, error, mutate } = useSWR(
    id ? endpoints.phoneModels.details(id) : null,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      model: data?.model || null,
      images: data?.images || [],
      advice: data?.advice || '',
      modelLoading: isLoading,
      modelError: error,
      refreshModel: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export async function createPhoneModel(payload) {
  const { data } = await axios.post(endpoints.phoneModels.list, payload);
  return data;
}

export async function updatePhoneModel(id, payload) {
  const { data } = await axios.patch(endpoints.phoneModels.details(id), payload);
  return data;
}

export async function deletePhoneModel(id) {
  await axios.delete(endpoints.phoneModels.details(id));
}

export async function uploadPhoneModelImages(id, files) {
  const form = new FormData();
  [...files].forEach((file) => form.append('images', file));
  const { data } = await axios.post(endpoints.phoneModels.images(id), form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deletePhoneModelImage(id, imageId) {
  await axios.delete(endpoints.phoneModels.deleteImage(id, imageId));
}

export async function reindexPhoneModels() {
  const { data } = await axios.post(endpoints.phoneModels.reindex);
  return data;
}
