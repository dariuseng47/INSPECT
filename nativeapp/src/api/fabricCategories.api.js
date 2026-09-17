import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchFabricCategories(params) {
  const { data } = await apiClient.get(endpoints.fabricCategories.list, { params });
  return data; // { categories }
}
