import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';

const CHECK_INTERVAL_MS = 60_000; // เช็คทุก 60 วิ
const OFFLINE_THRESHOLD_SECONDS = 60; // heartbeat เก่ากว่านี้ = offline (2x ของ interval ยิง 30 วิ)

// ตาม docs/device-network-failure-handling.md หัวข้อ 1 — ไม่มี heartbeat มาตามเวลาที่ตั้งไว้
// ให้ถือว่าอุปกรณ์หลุดโดยไม่ต้องรอ user มาแจ้งเอง
async function checkStaleDevices() {
  const [staleDevices] = await pool.query(
    `SELECT id, hospital_id FROM devices
     WHERE status = 'ONLINE'
       AND (last_heartbeat_at IS NULL OR last_heartbeat_at < NOW() - INTERVAL ? SECOND)`,
    [OFFLINE_THRESHOLD_SECONDS]
  );

  if (staleDevices.length === 0) return;

  const io = getIO();

  for (const device of staleDevices) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query('UPDATE devices SET status = ? WHERE id = ?', ['OFFLINE', device.id]);
    // eslint-disable-next-line no-await-in-loop
    await pool.query('INSERT INTO device_status_log (device_id, status) VALUES (?, ?)', [
      device.id,
      'OFFLINE',
    ]);

    if (io) {
      io.to(`hospital:${device.hospital_id}`).emit('device:status_changed', {
        deviceId: device.id,
        status: 'OFFLINE',
      });
    }
  }
}

export function startHeartbeatMonitor() {
  setInterval(() => {
    checkStaleDevices().catch((err) => {
      console.error('device heartbeat monitor error:', err);
    });
  }, CHECK_INTERVAL_MS);
}
