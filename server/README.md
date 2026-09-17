# Inspect Server

Backend API — Node.js (Express, Pure JS ES Modules) สำหรับระบบ auth/security/user-management
และระบบตรวจสอบรุ่นโทรศัพท์ (phone model recognition) ดู `phone-recognition-system-spec.md` ที่ root
ของ repo สำหรับสเปกเต็ม

## เริ่มต้นใช้งาน

```sh
cd server
npm install
```

### 1. ตั้งค่าฐานข้อมูล

กรอกข้อมูล MySQL ของคุณในไฟล์ `server/.env` (ส่วน `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` —
ค่าอื่นตั้งไว้ให้พร้อมใช้แล้ว รวมถึง JWT secret ที่สุ่มไว้ให้) และค่า `ML_SERVICE_URL` /
`ML_SERVICE_API_KEY` ให้ตรงกับ ML-Service ที่ deploy ไว้ (ดู `../ML-Service/README.md`)

สร้างตารางทั้งหมด (ไฟล์เดียว ไม่มี migration แยก — schema.sql ใช้ `CREATE TABLE IF NOT EXISTS` รันซ้ำได้):

```sh
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS inspect"
mysql -u root -p inspect < db/schema.sql
```

(ทางเลือก) สร้าง DB user สิทธิ์ต่ำสุดสำหรับ backend แทนการใช้ root — ดู `db/init_security.sql` แล้วนำ
user/password ที่สร้างไปกรอกใน `.env`

### 2. สร้างบัญชี superadmin คนแรก

```sh
npm run create-superadmin
```

### 3. รัน dev server

```sh
npm run dev
```

Server จะรันที่ `http://localhost:4000` (เปลี่ยนได้ที่ `PORT` ใน `.env`) — ทดสอบด้วย
`curl http://localhost:4000/health`

## โครงสร้างโปรเจกต์

```
src/
  config/env.js           โหลด + validate ตัวแปรจาก .env ด้วย zod (รวม ML_SERVICE_*)
  config/menuCatalog.js   permission catalogue (web.* + handheld.*) — source of truth ของ RBAC
  db/pool.js              mysql2/promise connection pool
  middleware/             helmet, cors, rate-limit, auth, upload (multer), validate, error handler
  controllers/            auth, users, permissions, auditLogs, loginPopupImages,
                          phoneModels, scans, unidentifiedQueue, reviewLogs, mlHealth
  routes/                 mount route ต่อ controller ด้านบน ใต้ /api/v1
  schemas/                zod schema สำหรับ validateRequest
  sockets/                Socket.io — online presence (global, ไม่มี tenant room แล้ว)
  utils/                  AppError, asyncHandler, JWT helper, mlClient (เรียก ML-Service),
                          imageAnnotate (วาดกรอบสี+legend ด้วย sharp)
db/
  schema.sql              DDL ทั้งหมด (users/RBAC + phone recognition tables)
  init_security.sql       ตัวอย่างสร้าง DB user สิทธิ์ต่ำสุด
scripts/
  create-superadmin.js    bootstrap บัญชี superadmin คนแรก
uploads/
  login-popup-images/     รูป popup หลัง login
  phone-models/           ภาพอ้างอิงของแต่ละรุ่นโทรศัพท์
  phone-scans/            ภาพต้นฉบับ/ภาพตีกรอบผลลัพธ์/ภาพ crop รายเครื่องจากการสแกน
```

## ขอบเขตระบบ

ระบบนี้ถูกรื้อลงมาจากระบบเดิม (multi-tenant hospital RFID/fabric asset-tracking) ให้เหลือเฉพาะ
core ที่จำเป็น: **authentication, RBAC/permissions, user management, audit logs, login popup
images** และฟีเจอร์ใหม่ **ตรวจสอบรุ่นโทรศัพท์** (object detection + embedding similarity ผ่าน
ML-Service แยก) ไม่มี concept "โรงพยาบาล"/multi-tenant หลงเหลืออยู่ — ทุก user อยู่ใน
namespace เดียวกัน ผูกกันด้วย `managed_by` (แอดมินคนไหนสร้าง/ดูแล operator คนไหน) แทน
