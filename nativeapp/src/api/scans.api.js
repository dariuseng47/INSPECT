import { apiClient } from './client';
import { endpoints } from './endpoints';

// asset: ผลลัพธ์จาก expo-image-picker ({ uri, mimeType, fileName })
export async function createScan(asset) {
  const form = new FormData();
  form.append('image', {
    uri: asset.uri,
    name: asset.fileName || 'scan.jpg',
    type: asset.mimeType || 'image/jpeg',
  });

  const { data } = await apiClient.post(endpoints.scans.list, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data; // { batch, items, summary }
}

export async function fetchScanBatches() {
  const { data } = await apiClient.get(endpoints.scans.list);
  return data.batches || [];
}
