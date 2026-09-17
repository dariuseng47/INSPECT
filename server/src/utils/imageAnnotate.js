import sharp from 'sharp';

// สีที่แยกความแตกต่างกันได้ชัดตาด้วยตาเปล่า — วนซ้ำถ้ารุ่นในภาพเดียวมีมากกว่านี้
const PALETTE = [
  '#FF3B30', '#34C759', '#007AFF', '#FF9500', '#AF52DE',
  '#5AC8FA', '#FFCC00', '#FF2D55', '#00C7BE', '#A2845E',
];

const UNCERTAIN_COLOR = '#8E8E93'; // เทา — ใช้กับ box ที่ระบบไม่มั่นใจ/ยังไม่รู้จัก

// คืนสีเดิมเสมอสำหรับ modelId เดียวกัน ภายในภาพเดียวกัน (ไม่ได้ผูกกับ modelId ข้ามภาพ เพราะแต่ละ
// ภาพมีแค่ไม่กี่รุ่นปะปนกัน สลับสีใหม่ทุกครั้งไม่เป็นปัญหา ขอแค่ในภาพเดียวกันสีไม่ซ้ำ/ไม่สลับ)
export function buildColorMap(modelIds) {
  const uniqueIds = [...new Set(modelIds.filter((id) => id != null))];
  const map = new Map();
  uniqueIds.forEach((id, i) => map.set(id, PALETTE[i % PALETTE.length]));
  return map;
}

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

/**
 * วาดกรอบสี + label บนภาพต้นฉบับ ตาม detections ที่ให้มา
 * detections: [{ x, y, w, h, color, label }]
 */
export async function drawAnnotations(imageBuffer, detections) {
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();

  const strokeWidth = Math.max(3, Math.round(Math.min(width, height) / 250));
  const fontSize = Math.max(16, Math.round(Math.min(width, height) / 45));

  const boxesSvg = detections
    .map(({ x, y, w, h, color, label }) => {
      const labelY = y > fontSize + 8 ? y - 8 : y + h + fontSize + 4;
      return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}"
              fill="none" stroke="${color}" stroke-width="${strokeWidth}" />
        <rect x="${x}" y="${labelY - fontSize}" width="${Math.max(label.length * fontSize * 0.62, fontSize * 2)}" height="${fontSize * 1.4}"
              fill="${color}" opacity="0.85" />
        <text x="${x + 4}" y="${labelY}" font-family="sans-serif" font-size="${fontSize}"
              font-weight="bold" fill="#ffffff">${escapeXml(label)}</text>
      `;
    })
    .join('\n');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${boxesSvg}</svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function cropRegion(imageBuffer, { x, y, w, h }) {
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();

  // กันพิกัดจาก detector เกินขอบภาพ (เช่น ปัดเศษ) ไม่งั้น sharp.extract() จะ throw
  const left = Math.max(0, Math.min(x, width - 1));
  const top = Math.max(0, Math.min(y, height - 1));
  const extractWidth = Math.max(1, Math.min(w, width - left));
  const extractHeight = Math.max(1, Math.min(h, height - top));

  return image.extract({ left, top, width: extractWidth, height: extractHeight }).jpeg({ quality: 90 }).toBuffer();
}

export { UNCERTAIN_COLOR };
