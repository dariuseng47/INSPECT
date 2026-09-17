import { apiClient } from './client';
import { endpoints } from './endpoints';

// Mirrors dashboard/src/actions/scanSessions.js + the flow in
// dashboard/src/sections/fabric/view/handheld-scan-card.jsx — this app plays the role of
// the "handheld device" that comment in server/src/controllers/scanSessions.controller.js
// says doesn't exist yet. Still user-JWT auth (not device-token) per that same comment.

export async function triggerScanSession({ fabricLotId, fabricCategoryId, deviceId }) {
  const { data } = await apiClient.post(endpoints.scanSessions.list, {
    fabricLotId,
    fabricCategoryId,
    deviceId,
  });
  return data; // { session }
}

export async function fetchScanSession(id) {
  const { data } = await apiClient.get(endpoints.scanSessions.details(id));
  return data; // { session }
}

export async function reportScanSession(id, { epcCodes }) {
  const { data } = await apiClient.post(endpoints.scanSessions.report(id), { epcCodes });
  return data;
}

export async function cancelScanSession(id) {
  await apiClient.post(endpoints.scanSessions.cancel(id));
}
