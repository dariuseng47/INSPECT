import { pool } from '../db/pool.js';

// ผ้าที่ค้างอยู่ในสถานะปัจจุบันเกินเวลาที่ตั้งไว้ใน status_timeout_settings
// ("ค้างสถานะ" ประมาณจาก fabric_items.updated_at เพราะยังไม่มีคอลัมน์ status_changed_at แยก)
// ใช้ร่วมกันระหว่าง tracking.controller.js (Process Status Monitor) และ alerts.controller.js
export async function getStuckItems(tenantId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT fi.id, fi.epc_code, fi.status, fi.updated_at, sts.max_hours,
            TIMESTAMPDIFF(HOUR, fi.updated_at, NOW()) AS hours_stuck
     FROM fabric_items fi
     JOIN status_timeout_settings sts
       ON sts.hospital_id = fi.hospital_id AND sts.status = fi.status
     WHERE fi.hospital_id = ? AND fi.deleted_at IS NULL
       AND TIMESTAMPDIFF(HOUR, fi.updated_at, NOW()) > sts.max_hours
     ORDER BY hours_stuck DESC
     LIMIT ?`,
    [tenantId, limit]
  );
  return rows;
}
