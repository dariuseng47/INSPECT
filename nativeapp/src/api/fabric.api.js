import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchFabricItems(params) {
  const { data } = await apiClient.get(endpoints.fabricItems.list, { params });
  return data; // { fabricItems }
}

export async function fetchFabricItemByEpc(epc) {
  const { data } = await apiClient.get(endpoints.fabricItems.details(epc));
  return data; // { fabricItem, scanHistory }
}

// `photo` is an expo-image-picker asset ({ uri, mimeType?, fileName? }) or undefined.
// Server expects multipart/form-data with a `photo` file field when a photo is attached
// (server/src/middleware/upload.js — multer .single('photo')); plain JSON otherwise.
function buildActionPayload({ reasonCode, photo }) {
  if (!photo) return { reasonCode };

  const formData = new FormData();
  formData.append('reasonCode', reasonCode);
  formData.append('photo', {
    uri: photo.uri,
    name: photo.fileName || 'damage-photo.jpg',
    type: photo.mimeType || 'image/jpeg',
  });
  return formData;
}

export async function holdFabricItem(id, { reasonCode, photo }) {
  const { data } = await apiClient.post(endpoints.fabricItems.hold(id), buildActionPayload({ reasonCode, photo }));
  return data;
}

export async function decommissionFabricItem(id, { reasonCode, photo }) {
  const { data } = await apiClient.post(
    endpoints.fabricItems.decommission(id),
    buildActionPayload({ reasonCode, photo })
  );
  return data;
}
