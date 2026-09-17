-- scan_logs ไม่มีที่เก็บ "เป้าหมาย" ของ event เช่น cabinet_id ของ WARD_ISSUE (เป็น polymorphic
-- location ที่ apply เข้า fabric_items.current_location_id ทันทีตอนไม่ conflict — แต่ตอน conflict
-- ต้อง "เก็บ" event ไว้ในสถานะ pending ไม่ apply ก็เลยไม่มีที่พักข้อมูลนี้) เพิ่ม metadata JSON กลางๆ
-- ไว้ใช้กับ context เพิ่มเติมของ event แบบนี้ — ดู docs/offline-sync-conflict-resolution.md
-- (จำเป็นเพื่อให้หน้า "ข้อมูลชนกันจากออฟไลน์" แสดง target ของแต่ละ candidate ให้ admin เทียบได้จริง)
ALTER TABLE scan_logs ADD COLUMN metadata JSON NULL AFTER synced_from_offline;
