import { pool } from '../db/pool.js';

// global_settings เป็นตารางแถวเดียว (id=1 เสมอ บังคับด้วย CHECK constraint)
// ใช้เป็นค่า default กลางที่จุดต่างๆ ในระบบ fallback ไปใช้เมื่อไม่ได้ระบุค่ามาเอง
export async function getGlobalSettings() {
  const [rows] = await pool.query('SELECT * FROM global_settings WHERE id = 1 LIMIT 1');
  return rows[0];
}
