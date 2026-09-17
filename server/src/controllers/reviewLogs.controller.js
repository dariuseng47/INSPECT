import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/review-logs — ประวัติการยืนยัน/ปฏิเสธ/สร้างรุ่นใหม่ของแอดมิน (ใช้ปรับ threshold ภายหลัง)
 */
export const listReviewLogs = asyncHandler(async (req, res) => {
  const limit = req.query.limit ?? 200;
  const [rows] = await pool.query(
    `SELECT rl.*, u.full_name AS admin_full_name, u.username AS admin_username
     FROM review_logs rl
     LEFT JOIN users u ON u.id = rl.admin_user_id
     ORDER BY rl.created_at DESC LIMIT ?`,
    [limit]
  );
  return res.json({ reviewLogs: rows });
});
