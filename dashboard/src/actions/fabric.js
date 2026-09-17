import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ===== Categories =====

export function useGetFabricCategories(hospitalId) {
  const url = hospitalId ? [endpoints.fabricCategories.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      categories: data?.categories || [],
      categoriesLoading: isLoading,
      categoriesError: error,
      refreshCategories: mutate,
    }),
    [data?.categories, error, isLoading, mutate]
  );
}

export async function createFabricCategory(payload) {
  const { data } = await axios.post(endpoints.fabricCategories.list, payload);
  return data;
}

export async function updateFabricCategory(id, payload) {
  await axios.patch(endpoints.fabricCategories.details(id), payload);
}

// ===== Lots =====

export function useGetFabricLots(hospitalId) {
  const url = [endpoints.fabricLots.list, { params: hospitalId ? { hospitalId } : {} }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      lots: data?.lots || [],
      lotsLoading: isLoading,
      lotsError: error,
      refreshLots: mutate,
    }),
    [data?.lots, error, isLoading, mutate]
  );
}

export async function createFabricLot(payload) {
  const { data } = await axios.post(endpoints.fabricLots.list, payload);
  return data;
}

// ===== Items =====

export function useGetFabricItems(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
  );
  const url = [endpoints.fabricItems.list, { params }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      fabricItems: data?.fabricItems || [],
      fabricItemsLoading: isLoading,
      fabricItemsError: error,
      fabricItemsEmpty: !isLoading && !data?.fabricItems?.length,
      refreshFabricItems: mutate,
    }),
    [data?.fabricItems, error, isLoading, mutate]
  );
}

export function useGetFabricItemDetail(epcCode, hospitalId) {
  const url = epcCode
    ? [endpoints.fabricItems.details(epcCode), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      fabricItem: data?.fabricItem,
      scanHistory: data?.scanHistory || [],
      detailLoading: isLoading,
      detailError: error,
      refreshDetail: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export async function createFabricItem(payload) {
  const { data } = await axios.post(endpoints.fabricItems.list, payload);
  return data;
}

// ลงทะเบียนหลายชิ้นพร้อมกัน (เช่น รับผ้าล็อตใหม่ทีละหลัก 100 ชิ้น) — คืน { created, skipped }
export async function bulkCreateFabricItems(payload) {
  const { data } = await axios.post(endpoints.fabricItems.bulk, payload);
  return data;
}

export async function holdFabricItem(id, payload) {
  const { data } = await axios.post(endpoints.fabricItems.hold(id), payload);
  return data;
}

export async function decommissionFabricItem(id, payload) {
  const { data } = await axios.post(endpoints.fabricItems.decommission(id), payload);
  return data;
}

// เปลี่ยนสถานะผ้าด้วยมือจาก popup หน้าคลังผ้า — ใช้ endpoint เดียวกับเมนู "เปลี่ยนสถานะผ้า" บนมือถือ
// ส่งทีละชิ้น (epcCodes: [epcCode]) confirm=true เปลี่ยนเลย ต้องมีสิทธิ์ fabric.item.status_change
export async function changeFabricItemStatus({ epcCode, fromStatus, toStatus }) {
  const { data } = await axios.post(endpoints.scans.statusChange, {
    epcCodes: [epcCode],
    fromStatus,
    toStatus,
    confirm: true,
  });
  return data;
}
