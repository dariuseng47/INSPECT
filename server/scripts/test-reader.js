// ทดสอบเชื่อมต่อเครื่องที่ซุ้ม 192.168.0.250 ด้วยโปรโตคอล SID-U881 ที่มีอยู่แล้วในระบบ
// รันบนเครื่อง (Windows) ที่เสียบสาย LAN ตรงกับอุปกรณ์:  node scripts/test-reader.js
import { queryTags } from '../src/services/rfidReader.js';

const ip = process.argv[2] || '192.168.0.250';
const port = Number(process.argv[3] || 27011);

console.log(`กำลังต่อ ${ip}:${port} แล้วสั่ง inventory 1 รอบ ...`);
try {
  const result = await queryTags({ ip, port, connectTimeoutMs: 5000, idleTimeoutMs: 2000 });
  console.log('เชื่อมต่อสำเร็จ ✅');
  console.log(`อ่าน EPC ได้ ${result.epcs.length} รายการ:`);
  for (const t of result.epcs) console.log(`  ${t.epc}  (RSSI ${t.rssi})`);
  if (result.epcs.length === 0) console.log('  (ต่อติดแต่ยังไม่มีแท็กในสนามอ่าน — ลองเอาผ้าที่ติดแท็กไปแตะที่ซุ้ม)');
} catch (err) {
  console.error('เชื่อมต่อไม่สำเร็จ ❌', err.message);
}
