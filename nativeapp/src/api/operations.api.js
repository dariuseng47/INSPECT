import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function wardIssueScan(payload) {
  const { data } = await apiClient.post(endpoints.operations.wardIssue, payload);
  return data;
}

export async function wardReceiveScan(payload) {
  const { data } = await apiClient.post(endpoints.operations.wardReceive, payload);
  return data;
}

export async function cabinetAuditScan(payload) {
  const { data } = await apiClient.post(endpoints.operations.cabinetAudit, payload);
  return data;
}

// confirm=false -> preview (จัดกลุ่ม ready/mismatched/blocked/alreadyDone/notFound)
// confirm=true  -> เปลี่ยนสถานะจริง (ready + mismatched) + log ทุกชิ้น
export async function statusChangeScan(payload) {
  const { data } = await apiClient.post(endpoints.operations.statusChange, payload);
  return data;
}

export async function fetchLocationByEpc(epc) {
  const { data } = await apiClient.get(endpoints.operations.location(epc));
  return data;
}

export async function fetchWardIssueRounds(params) {
  const { data } = await apiClient.get(endpoints.operations.wardIssueRounds, { params });
  return data;
}
