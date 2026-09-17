import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchDevices(params) {
  const { data } = await apiClient.get(endpoints.devices.list, { params });
  return data; // { devices }
}
