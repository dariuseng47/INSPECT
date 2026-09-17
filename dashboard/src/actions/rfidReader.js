import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export async function scanCheckpoint(deviceId, hospitalId) {
  const { data } = await axios.post(endpoints.rfidReader.scan, {
    deviceId,
    ...(hospitalId ? { hospitalId } : {}),
  });
  return data; // { epcs: [{ epc, rssi }] }
}
