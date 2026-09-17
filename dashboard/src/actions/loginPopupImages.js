import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetLoginPopupImages() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.loginPopupImages.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      images: data?.images ?? [],
      imagesLoading: isLoading,
      imagesError: error,
      refreshImages: mutate,
    }),
    [data?.images, error, isLoading, mutate]
  );
}

// key เป็น null ตอนยังไม่ต้องเรียก (เช่น ยังไม่ผ่านเงื่อนไข "เพิ่ง login สำเร็จ") — SWR จะไม่ยิง request
export function useGetLoginPopupImagesForMe(shouldFetch) {
  const { data, isLoading, error } = useSWR(
    shouldFetch ? endpoints.loginPopupImages.forMe : null,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      images: data?.images ?? [],
      imagesLoading: isLoading,
      imagesError: error,
    }),
    [data?.images, error, isLoading]
  );
}

export async function createLoginPopupImage(formData) {
  const { data } = await axios.post(endpoints.loginPopupImages.list, formData);
  return data;
}

export async function updateLoginPopupImage(id, formData) {
  const { data } = await axios.patch(endpoints.loginPopupImages.details(id), formData);
  return data;
}

export async function deleteLoginPopupImage(id) {
  const { data } = await axios.delete(endpoints.loginPopupImages.details(id));
  return data;
}
