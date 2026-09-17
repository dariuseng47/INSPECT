import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchPhoneModels() {
  const { data } = await apiClient.get(endpoints.phoneModels.list);
  return data.models || [];
}
