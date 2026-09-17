-- รองรับการลากจัดเรียงชั้นในตึก / แผนกในชั้นเอง (ไม่ต้องเรียงเลขชั้นให้ครบ 1,2,3,4)
-- sort_order คือลำดับแสดงผลภายใน parent เดียวกัน (ตึกระดับบนสุด parent_id เป็น NULL)
-- ข้อมูลเดิมที่มีอยู่แล้วจะถูก backfill ให้เรียงตาม id เดิมแยกทีหลัง (ดูสคริปต์ apply migration)
ALTER TABLE departments ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER name;
