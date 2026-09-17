import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function resolveQueueItem(id, payload) {
  const { data } = await apiClient.put(endpoints.unidentifiedQueue.resolve(id), payload);
  return data;
}

export async function rejectQueueItem(id) {
  await apiClient.put(endpoints.unidentifiedQueue.reject(id), {});
}

// assets: ผลลัพธ์ array จาก expo-image-picker (allowsMultipleSelection)
export async function addExtraImages(id, assets) {
  const form = new FormData();
  assets.forEach((asset, index) => {
    form.append('images', {
      uri: asset.uri,
      name: asset.fileName || `extra-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  });
  const { data } = await apiClient.post(endpoints.unidentifiedQueue.extraImages(id), form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
