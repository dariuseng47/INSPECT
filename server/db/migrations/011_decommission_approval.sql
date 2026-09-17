-- แทงชำรุดที่แจ้งมาจากมือถือ (nativeapp/) ต้องรอ admin โรงพยาบาลกด approve ที่ dashboard ก่อน
-- ถึงจะมีผลจริง (ต่างจากพักผ้า และต่างจากแทงชำรุดที่ทำผ่านหน้าเว็บเอง ซึ่งมีผลทันทีเหมือนเดิม)
-- ดู server/src/controllers/fabricItems.controller.js / decommissionRequests.controller.js

ALTER TABLE fabric_items
  MODIFY COLUMN status ENUM(
    'WASH','DRY','WEIGHT_COUNT','FOLDING_QC','CENTRAL_STOCK',
    'WARD_CABINET','IN_USE_WARD','HOLD','DECOMMISSIONED','PENDING_DECOMMISSION'
  ) NOT NULL;

ALTER TABLE hold_decommission_records
  -- ค่า default 'APPROVED' กันไม่ให้ record เก่าที่เคยมีผลทันทีอยู่แล้วกลายเป็น pending ย้อนหลัง
  ADD COLUMN status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER photo_url,
  -- เก็บสถานะเดิมของ fabric_items ก่อนเข้าสถานะ PENDING_DECOMMISSION ไว้คืนค่าตอน reject
  -- (มีความหมายเฉพาะ record ที่ status = PENDING เท่านั้น)
  ADD COLUMN previous_status VARCHAR(50) NULL AFTER status,
  ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER created_by,
  ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by,
  ADD COLUMN review_note VARCHAR(255) NULL AFTER reviewed_at,
  ADD FOREIGN KEY (reviewed_by) REFERENCES users(id);
