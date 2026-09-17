-- PIN 6 หลักสำหรับ login จาก handheld แทน username/password ได้ (เลือกได้ทั้งสองแบบ ไม่ได้ตัดออก)
-- เก็บเป็น HMAC-SHA256(pin, PIN_PEPPER) แทน bcrypt ปกติที่ password_hash ใช้ เพราะ login ด้วย PIN
-- ต้อง lookup หา user จาก PIN ตรงๆ ด้วย indexed query เดียว (ไม่ใช่ไล่ bcrypt.compare ทีละคนทั้งระบบ)
-- และต้องบังคับห้าม PIN ซ้ำกันทั้งระบบด้วย UNIQUE constraint — bcrypt สุ่ม salt ต่อ record ทำให้
-- input เดียวกันได้ hash คนละอันทุกครั้ง จึงใช้ UNIQUE ไม่ได้และ lookup ตรงไม่ได้ (ดู server/src/utils/pin.js)
ALTER TABLE users
  ADD COLUMN pin_hash CHAR(64) NULL UNIQUE AFTER password_hash;
