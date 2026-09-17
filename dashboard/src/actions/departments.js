import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetDepartments(hospitalId) {
  const url = [endpoints.departments.list, { params: hospitalId ? { hospitalId } : {} }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      departments: data?.departments || [],
      departmentsLoading: isLoading,
      departmentsError: error,
      refreshDepartments: mutate,
    }),
    [data?.departments, error, isLoading, mutate]
  );
}

export async function createDepartment(payload) {
  const { data } = await axios.post(endpoints.departments.list, payload);
  return data;
}

export async function updateDepartment(id, payload) {
  await axios.patch(endpoints.departments.details(id), payload);
}

export async function deleteDepartment(id) {
  await axios.delete(endpoints.departments.details(id));
}
