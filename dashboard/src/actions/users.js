import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetUsers({ role } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  const query = params.toString();
  const url = query ? `${endpoints.users.list}?${query}` : endpoints.users.list;
  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, swrOptions);

  const memoizedValue = useMemo(
    () => ({
      users: data?.users || [],
      usersLoading: isLoading,
      usersError: error,
      usersValidating: isValidating,
      usersEmpty: !isLoading && !data?.users.length,
      refreshUsers: mutate,
    }),
    [data?.users, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export async function createUser(payload) {
  const { data } = await axios.post(endpoints.users.list, payload);
  return data;
}

export async function updateUser(id, payload) {
  await axios.patch(endpoints.users.details(id), payload);
}

export async function deleteUser(id) {
  await axios.delete(endpoints.users.details(id));
}
