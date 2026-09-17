import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchFabricLots(params) {
  const { data } = await apiClient.get(endpoints.fabricLots.list, { params });
  return data; // { lots }
}
