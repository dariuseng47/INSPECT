# Inspect — Phone Model Recognition System — Project Spec

## 1. Overview

ระบบวิเคราะห์รุ่นโทรศัพท์มือถือจากภาพถ่าย โดยเปรียบเทียบกับฐานข้อมูลภาพอ้างอิงของแต่ละรุ่น รองรับการอัพโหลดแบบ bulk และสรุปผลจำนวนเครื่อง/รุ่น/ความจุขั้นต่ำหลังสแกนแต่ละครั้ง มีระบบ human-in-the-loop สำหรับกรณีที่ระบบไม่มั่นใจ และสามารถเรียนรู้รุ่นใหม่เพิ่มเติมได้โดยไม่ต้อง retrain โมเดลทั้งหมด

## 2. Tech Stack

- **Web Admin**: React
- **Mobile App (เครื่องมือสแกนหลัก)**: React Native
- **Backend API**: Node.js
- **Database**: MySQL
- **ML Service (แยก microservice)**: Python — ทำ image embedding + similarity search (แนะนำโมเดล embedding แบบ pretrained เช่น DINOv2/DINOv3 หรือเทียบเท่า)

> เหตุผลที่แยก ML เป็น service ต่างหาก: ใช้วิธี embedding + similarity search แทนการ train classifier ใหม่ทุกครั้ง ทำให้ "เพิ่ม/ลบภาพอ้างอิงแล้วประมวลผลใหม่" ทำได้ทันทีโดยไม่ต้อง retrain โมเดลใหญ่

## 3. Core Recognition Flow

1. ผู้ใช้อัพโหลดภาพ (เดี่ยวหรือ bulk) ผ่านแอป React Native
2. ระบบตัดแยกประมวลผลทีละภาพ → ส่งไป ML service เพื่อคำนวณ embedding vector
3. เทียบ cosine similarity กับภาพอ้างอิงในฐานข้อมูล → ได้ top candidate พร้อม confidence score
4. ตัดสินใจตาม threshold:
   - **Confidence สูง** → จับคู่รุ่นอัตโนมัติ
   - **Confidence ต่ำ / มีหลายรุ่นใกล้เคียงกันมาก** → เข้าสถานะ "ไม่แน่ใจ" (unidentified/ambiguous)
5. กรณีไม่แน่ใจ → ส่ง top candidates กลับไปให้ผู้ใช้เลือกเอง (พร้อมภาพตัวอย่างของแต่ละรุ่นประกอบการตัดสินใจ)
6. ถ้าไม่ตรงกับตัวเลือกใดเลย (รุ่นใหม่ที่ยังไม่มีในระบบ) → ขอให้ผู้ใช้ถ่ายภาพเครื่องนั้นเพิ่มหลายมุม (หน้า/หลัง/ข้าง/โลโก้ ฯลฯ) → เก็บเข้าคิวรอแอดมินตั้งชื่อรุ่น + ความจุ ก่อนนำเข้าฐานข้อมูลจริง
7. สรุปผลการสแกนแต่ละครั้ง (batch): รุ่นอะไรบ้าง, จำนวนกี่เครื่องต่อรุ่น, ความจุขั้นต่ำของแต่ละรุ่น

## 4. Capacity (GB) Logic

- ความจุที่แจ้งกลับ **ไม่ได้วิเคราะห์จากภาพ** แต่เป็นค่าที่ผูกไว้ล่วงหน้ากับแต่ละรุ่นในฐานข้อมูล (ความจุขั้นต่ำที่เคยผลิตของรุ่นนั้น)
- เมื่อระบบจับคู่รุ่นได้ → ดึงค่า `min_capacity_gb` จากตาราง `phone_models` มาแสดงทันที

## 5. Feature List — React (Web Admin)

- **หน้าสแกน**: อัพโหลดภาพ (รองรับ bulk) เหมือนฝั่งแอป
- **จัดการรุ่นโทรศัพท์ (Phone Models)**
  - เพิ่ม/แก้ไข/ลบรุ่น (ชื่อรุ่น, ยี่ห้อ, ความจุขั้นต่ำ)
  - อัพโหลดภาพอ้างอิง (training images) ต่อรุ่น — เพิ่มได้หลายภาพ/หลายมุม/หลายสี
  - ตั้งภาพหลัก (cover image) ของรุ่น สำหรับใช้ประกอบตอนถามผู้ใช้ตอนไม่แน่ใจ
  - ลบภาพอ้างอิงที่ผิด/ไม่ต้องการ
  - ปุ่ม "ประมวลผลใหม่" (re-index/re-embed) หลังเพิ่ม/ลบภาพ — ไม่ต้อง retrain โมเดลทั้งระบบ
- **คิวตรวจสอบ (Unidentified Queue)**
  - ดูภาพที่ระบบไม่มั่นใจ/ยังไม่รู้จัก
  - ยืนยัน/ปฏิเสธ/มอบหมายรุ่นให้ภาพนั้น
  - รับภาพชุดใหม่จากผู้ใช้ (หลายมุม) เพื่อสร้างรุ่นใหม่ในระบบ
- **ประวัติการสแกน (Scan History / Batches)**
  - ดูสรุปผลแต่ละครั้งที่มีการสแกน: วันที่, จำนวนเครื่อง, แยกตามรุ่น, ความจุ
- **Log การแก้ไข**: บันทึกว่าแอดมินยืนยัน/แก้ไขผิดพลาดจุดไหนบ้าง เพื่อใช้ปรับ threshold ภายหลัง

## 6. Feature List — React Native (Mobile App / เครื่องสแกนหลัก)

- ถ่ายภาพ/อัพโหลดภาพแบบ bulk เพื่อสแกน
- แสดงผลลัพธ์แบบเรียลไทม์ระหว่างประมวลผล (progress ทีละภาพ)
- สรุปยอดท้ายรอบ: จำนวนเครื่องทั้งหมด, แยกตามรุ่น, ความจุขั้นต่ำต่อรุ่น
- Prompt กลับผู้ใช้เมื่อระบบไม่มั่นใจ: แสดง top candidates พร้อมภาพตัวอย่างให้เลือก
- ฟีเจอร์ "ถ่ายเพิ่มหลายมุม" เมื่อเจอเครื่องที่ระบบไม่รู้จัก (ส่งเข้าคิวให้แอดมินตรวจ)
- ประวัติการสแกนของผู้ใช้ (ย้อนดู batch ก่อนหน้า)

## 7. Database Schema (Draft)

```sql
-- รุ่นโทรศัพท์
phone_models (
  id, brand, model_name, min_capacity_gb,
  cover_image_path, created_at, updated_at
)

-- ภาพอ้างอิงของแต่ละรุ่น (training images)
phone_model_images (
  id, model_id (FK), image_path,
  embedding_vector (หรือ path ไปยังไฟล์/index ที่เก็บ vector),
  is_active, uploaded_at
)

-- รอบการสแกน
scan_batches (
  id, user_id, source (web/app), created_at
)

-- รายการภาพในแต่ละรอบสแกน
scan_items (
  id, batch_id (FK), image_path,
  matched_model_id (FK, nullable),
  confidence_score,
  status (auto_matched / user_confirmed / unidentified / pending_review),
  created_at
)

-- คิวรุ่นที่ยังไม่รู้จัก / รอตรวจสอบ
unidentified_queue (
  id, scan_item_id (FK), candidate_model_ids (JSON, top matches),
  extra_images (JSON, ภาพหลายมุมที่ถ่ายเพิ่ม),
  resolved_model_id (FK, nullable),
  status (pending / resolved / new_model_created),
  created_at, resolved_at
)

-- log การแก้ไข/ยืนยันของแอดมิน
review_logs (
  id, unidentified_queue_id (FK), admin_user_id,
  action, note, created_at
)
```

## 8. API Boundary — Node.js ↔ ML Service (Python)

- `POST /ml/embed` — รับภาพ → คืน embedding vector
- `POST /ml/match` — รับ embedding (หรือภาพ) → คืน top-N candidates พร้อม similarity score
- `POST /ml/reindex` — trigger ประมวลผลใหม่หลังเพิ่ม/ลบภาพอ้างอิงของรุ่นใดรุ่นหนึ่ง (หรือทั้งหมด)

Node.js เป็นตัวกลางรับ request จาก React/React Native → เรียก ML service → บันทึกผลลง MySQL → ส่งกลับ client

## 9. Confidence Threshold Logic (ต้องปรับจูนจริงตอน implement)

- Threshold สูง → auto match
- Threshold กลาง หรือ top-2 candidates คะแนนใกล้กันเกินไป → ส่งเข้าสถานะ "ไม่แน่ใจ" ให้ผู้ใช้เลือก
- ไม่มี candidate ไหนผ่าน threshold ต่ำสุดเลย → ถือว่าเป็นรุ่นใหม่ที่ไม่รู้จัก → ขอถ่ายภาพเพิ่ม

## 10. Known Risk Points

- รุ่นเดียวกันแต่ต่างสี/สภาพเครื่อง (มีเคส, มีรอย) → ลดความแม่นยำ ต้องมีภาพอ้างอิงหลากหลายสี/สภาพต่อรุ่น
- รุ่นที่หน้าตาคล้ายกันมาก (เช่น รุ่นติดกันในซีรีส์เดียวกัน) → จะเข้าคิว "ไม่แน่ใจ" บ่อยในช่วงแรก ต้องอาศัยข้อมูล + feedback loop เพื่อปรับความแม่นยำ

## 11. Suggested Build Order (สำหรับ Claude Code)

1. Setup MySQL schema (Section 7)
2. Build ML service (Python): embed + match + reindex endpoints
3. Build Node.js API layer เชื่อม MySQL + ML service
4. Build React Admin: จัดการรุ่น/ภาพ, ปุ่ม reindex, unidentified queue
5. Build React Native: bulk upload, scan flow, สรุปผล, prompt ตอบกลับตอนไม่แน่ใจ, ถ่ายภาพเพิ่ม
6. เก็บ log จริงจากการใช้งาน → กลับมาปรับ threshold

## 12. MVP Deployment (DigitalOcean, ทดสอบ ~10 รุ่น)

| ส่วน | สเปค | ราคา/เดือน |
|---|---|---|
| Node.js API (Droplet) | 2 vCPU / 4 GB | $24 |
| Python ML Service (Droplet) | 2 vCPU / 4 GB (dinov2-small, CPU-only) | $24 |
| Managed MySQL | 1-2 vCPU / 2-4 GB | $15 |
| Spaces (เก็บภาพ) | 250 GB + CDN | $5 |
| React Admin (App Platform) | Static site | $0 |
| Plesk (Web Admin Edition) | จัดการสูงสุด 10 โดเมน | $16.99 |

ML Service ใช้โมเดล `facebook/dinov2-small` ผ่าน HuggingFace `transformers` + PyTorch (CPU) ห่อเป็น FastAPI endpoint `/embed` — self-hosted ทั้งหมด ไม่มีค่าใช้จ่ายต่อภาพ

## 13. Project Folder Structure

```
project-root/
├── dashboard/       # React — แดชบอร์ดจัดการระบบ
│                     #   - เมนูตรวจสอบรุ่นโทรศัพท์
│                     #   - เมนูเพิ่มข้อมูล/ภาพ (จัดการ phone_models + training images)
│                     #   - เมนูอื่นๆ (ประวัติการสแกน, คิวตรวจสอบ, ตั้งค่าระบบ ฯลฯ)
│
├── nativeapp/       # React Native — แอป Android ตรวจสอบภาพ (สแกนหลัก)
│
├── server/          # Node.js — API server เชื่อม dashboard/nativeapp กับ MySQL และ ML-Service
│
└── ML-Service/      # Python — ML microservice (embedding + similarity search)
```
