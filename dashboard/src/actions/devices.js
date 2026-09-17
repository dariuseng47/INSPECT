import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetDevices(hospitalId, deviceType) {
  // superadmin ต้องเลือกโรงพยาบาลก่อนเสมอ (resolveTenantId ฝั่ง backend บังคับ ?hospitalId=)
  // ถ้ายังไม่รู้ hospitalId (เช่น ตอน useEffectiveHospital ยังโหลดค่าเริ่มต้นไม่เสร็จ) ห้ามยิง request
  const params = { ...(hospitalId ? { hospitalId } : {}), ...(deviceType ? { deviceType } : {}) };
  const url = hospitalId ? [endpoints.devices.list, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      devices: data?.devices || [],
      devicesLoading: isLoading,
      devicesError: error,
      refreshDevices: mutate,
    }),
    [data?.devices, error, isLoading, mutate]
  );
}

export async function createDevice(payload) {
  const { data } = await axios.post(endpoints.devices.list, payload);
  return data;
}

export async function updateDevice(id, payload) {
  const { data } = await axios.patch(`${endpoints.devices.list}/${id}`, payload);
  return data;
}

export async function deleteDevice(id) {
  await axios.delete(`${endpoints.devices.list}/${id}`);
}

export async function rotateDeviceToken(id) {
  const { data } = await axios.post(endpoints.devices.rotateToken(id));
  return data;
}
