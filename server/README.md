# LMS Server

Backend API — Node.js (Express, Pure JS ES Modules) สำหรับ Multi-Tenant IoT RFID Laundry Management System

## เริ่มต้นใช้งาน

```sh
cd server
npm install
```

### 1. ตั้งค่าฐานข้อมูล

กรอกข้อมูล MySQL ของคุณในไฟล์ `server/.env` (ส่วน `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — ค่าอื่นตั้งไว้ให้พร้อมใช้แล้ว รวมถึง JWT secret ที่สุ่มไว้ให้)

สร้างตารางทั้งหมด:

```sh
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS laundry_db"
mysql -u root -p laundry_db < db/schema.sql
```

(ทางเลือก) สร้าง DB user สิทธิ์ต่ำสุดสำหรับ backend แทนการใช้ root — ดู `db/init_security.sql` แล้วนำ user/password ที่สร้างไปกรอกใน `.env`

### 2. สร้างบัญชี superadmin คนแรก

```sh
npm run create-superadmin
```

### 3. รัน dev server

```sh
npm run dev
```

Server จะรันที่ `http://localhost:4000` (เปลี่ยนได้ที่ `PORT` ใน `.env`) — ทดสอบด้วย `curl http://localhost:4000/health`

## โครงสร้างโปรเจกต์

```
src/
  config/env.js         โหลด + validate ตัวแปรจาก .env ด้วย zod
  db/pool.js             mysql2/promise connection pool
  db/scopedQuery.js       tenant isolation wrapper (docs/multi-tenant-isolation.md)
  middleware/             helmet, cors, rate-limit, auth, validate, error handler
  controllers/            business logic ต่อ endpoint
  routes/                 mount route ตาม docs/api-spec.md
  schemas/                zod schema สำหรับ validateRequest
  sockets/                Socket.io + tenant room join
  utils/                  AppError, asyncHandler, JWT helper
db/
  schema.sql              DDL ตั้งต้นทั้งหมด (รวมจาก docs/data-model.md ฯลฯ)
  init_security.sql       สร้าง DB user สิทธิ์ต่ำสุด
scripts/
  create-superadmin.js    bootstrap บัญชี superadmin คนแรก
```

ปัจจุบันมีเฉพาะ `auth` routes (login/refresh/logout/me) ครบตาม spec — ส่วน endpoint อื่นตาม `docs/api-spec.md` (fabric-items, scans, devices, transfers, sync, alerts) ยังไม่ได้ implement รอทำต่อ
