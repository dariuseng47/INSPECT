import { mlHealth } from '../utils/mlClient.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/ml-health — proxy ไป ML-Service (dashboard top bar โพลผ่าน Node เท่านั้น ไม่ยิงตรง)
 * ไม่ throw ถ้า ML-Service ล่ม/เอื้อมไม่ถึง — คืน status: 'unreachable' ให้ UI แสดงแทน error 500
 */
export const getMlHealth = asyncHandler(async (req, res) => {
  try {
    const health = await mlHealth();
    return res.json({ ...health, reachable: true });
  } catch (error) {
    return res.json({ status: 'unreachable', reachable: false, error: error.message });
  }
});
