import { env } from '../config/env.js';
import { AppError } from './AppError.js';

// Client เรียก ML-Service (Python/FastAPI) — ทุก request แนบ X-API-Key เสมอ (ดู ML-Service/app/main.py)
// Node เป็นตัวกลางเดียวที่คุยกับ ML-Service โดยตรง (dashboard/nativeapp ไม่เรียกตรงเด็ดขาด)

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = { 'X-API-Key': env.ML_SERVICE_API_KEY };
  if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${env.ML_SERVICE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AppError(502, 'ML_SERVICE_UNREACHABLE', 'ไม่สามารถเชื่อมต่อ ML-Service ได้ในขณะนี้');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(502, 'ML_SERVICE_ERROR', `ML-Service ตอบผิดพลาด (${res.status}): ${text}`);
  }
  return res.json();
}

function imageFormData(imageBuffer, filename = 'image.jpg') {
  const form = new FormData();
  form.append('image', new Blob([imageBuffer]), filename);
  return form;
}

export async function mlDetect(imageBuffer) {
  const data = await request('/detect', { method: 'POST', body: imageFormData(imageBuffer), isFormData: true });
  return data.detections; // [{x, y, w, h, confidence}]
}

export async function mlEmbed(imageBuffer) {
  const data = await request('/embed', { method: 'POST', body: imageFormData(imageBuffer), isFormData: true });
  return data.embedding; // number[]
}

export async function mlMatch(embedding, topK = 5) {
  const data = await request('/match', { method: 'POST', body: { embedding, topK } });
  return data.candidates; // [{modelId, score}]
}

export async function mlReindex(entries) {
  // entries: [{ imageId, modelId, imageBase64 }]
  return request('/reindex', { method: 'POST', body: { entries } });
}

export async function mlHealth() {
  return request('/health');
}
