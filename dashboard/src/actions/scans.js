import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export async function wardIssueScan(payload) {
  const { data } = await axios.post(endpoints.scans.wardIssue, payload);
  return data;
}

export async function wardReceiveScan(payload) {
  const { data } = await axios.post(endpoints.scans.wardReceive, payload);
  return data;
}

export async function washReceiveBatchScan(payload) {
  const { data } = await axios.post(endpoints.scans.washReceiveBatch, payload);
  return data;
}

export async function stockScan(payload) {
  const { data } = await axios.post(endpoints.scans.stockScan, payload);
  return data;
}
