-- เพิ่มคำอธิบายเพิ่มเติมให้หมวดหมู่ผ้า (เช่น ขนาด/สี/ลักษณะเฉพาะ ที่ชื่อหมวดหมู่สั้นๆ ไม่พอสื่อ)
ALTER TABLE fabric_categories
  ADD COLUMN description VARCHAR(500) NULL AFTER name;
