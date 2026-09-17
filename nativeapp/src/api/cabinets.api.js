import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchCabinets(params) {
  const { data } = await apiClient.get(endpoints.cabinets.list, { params });
  return data; // { cabinets }
}
