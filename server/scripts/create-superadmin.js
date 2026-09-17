// สร้างบัญชี superadmin คนแรกของระบบ (ใช้ครั้งเดียวตอน setup)
// ใช้งาน: npm run create-superadmin -- <username> <password> <pin> <full_name>
import readline from 'node:readline/promises';

import bcrypt from 'bcryptjs';

import { pool } from '../src/db/pool.js';
import { hashPin } from '../src/utils/pin.js';

async function main() {
  const [, , argUsername, argPassword, argPin, ...rest] = process.argv;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const username = argUsername || (await rl.question('Username: '));
  const password = argPassword || (await rl.question('Password (8+ ตัวอักษร): '));
  // ทุก role ต้องมี PIN สำหรับ login จาก handheld รวม superadmin ด้วย แม้จะไม่ได้ใช้ handheld
  // เป็นประจำ — กันไว้เผื่อต้องแก้ไขปัญหาหน้างานผ่าน handheld บางครั้ง
  const pin = argPin || (await rl.question('PIN 6 หลัก (สำหรับ login จาก handheld): '));
  const fullName = rest.join(' ') || (await rl.question('ชื่อ-นามสกุล: '));

  rl.close();

  if (!username || !password || password.length < 8) {
    console.error('❌ ต้องระบุ username และ password (อย่างน้อย 8 ตัวอักษร)');
    process.exit(1);
  }
  if (!pin || !/^\d{6}$/.test(pin)) {
    console.error('❌ ต้องระบุ PIN เป็นตัวเลข 6 หลัก');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pinHash = hashPin(pin);

  const [existingPin] = await pool.query('SELECT id FROM users WHERE pin_hash = ? LIMIT 1', [
    pinHash,
  ]);
  if (existingPin[0]) {
    console.error('❌ PIN นี้ถูกใช้แล้วโดยผู้ใช้อื่น กรุณาเลือก PIN อื่น');
    process.exit(1);
  }

  await pool.query(
    `INSERT INTO users (hospital_id, role, username, password_hash, pin_hash, full_name, is_active)
     VALUES (NULL, 'SUPERADMIN', ?, ?, ?, ?, TRUE)`,
    [username, passwordHash, pinHash, fullName || username]
  );

  console.log(`✅ สร้าง superadmin "${username}" สำเร็จแล้ว`);
  await pool.end();
}

main().catch((error) => {
  console.error('❌ สร้าง superadmin ไม่สำเร็จ:', error.message);
  process.exit(1);
});
