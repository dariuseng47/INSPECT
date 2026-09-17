import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetCabinets(hospitalId, departmentId) {
  const params = { ...(hospitalId ? { hospitalId } : {}), ...(departmentId ? { departmentId } : {}) };
  const url = [endpoints.cabinets.list, { params }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      cabinets: data?.cabinets || [],
      cabinetsLoading: isLoading,
      cabinetsError: error,
      refreshCabinets: mutate,
    }),
    [data?.cabinets, error, isLoading, mutate]
  );
}

export async function createCabinet(payload) {
  const { data } = await axios.post(endpoints.cabinets.list, payload);
  return data;
}

export async function updateCabinet(id, payload) {
  const { data } = await axios.patch(endpoints.cabinets.details(id), payload);
  return data;
}

export async function deleteCabinet(id) {
  await axios.delete(endpoints.cabinets.details(id));
}

export function useGetParLevels(cabinetId, hospitalId) {
  const url = cabinetId
    ? [endpoints.cabinets.parLevels(cabinetId), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      parLevels: data?.parLevels || [],
      parLevelsLoading: isLoading,
      parLevelsError: error,
      refreshParLevels: mutate,
    }),
    [data?.parLevels, error, isLoading, mutate]
  );
}

export async function saveParLevels(cabinetId, parLevels) {
  await axios.put(endpoints.cabinets.parLevels(cabinetId), { parLevels });
}
