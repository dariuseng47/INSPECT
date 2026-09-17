# ML-Service

Python (FastAPI) microservice สำหรับตรวจสอบรุ่นโทรศัพท์จากภาพ — ดู
`../phone-recognition-system-spec.md` สำหรับสเปกเต็ม

- **Detection**: YOLOv8n (pretrained บน COCO, ใช้คลาส `cell phone` ตรงๆ — zero-shot ไม่ต้อง
  train เพิ่ม) หาตำแหน่งโทรศัพท์แต่ละเครื่องในภาพที่วางเรียงบนโต๊ะ/ถาด
- **Embedding**: `facebook/dinov2-small` (pretrained, self-supervised) แปลงแต่ละภาพ (ทั้งภาพ
  อ้างอิงตอนเทรน และภาพ crop ตอน match) เป็น vector เดียวกัน เทียบกันด้วย cosine similarity
- **Index**: เก็บ embedding ทุกภาพอ้างอิงไว้ใน memory + persist ลงดิสก์ (`data/embedding_index.npz`)
  กันรีสตาร์ทแล้วข้อมูลหาย — ไม่คุยกับ MySQL เอง (Node เป็นตัวกลางเสมอ ส่ง entries มาตอน `/reindex`)

Server access (SFTP/SSH) ของเครื่องที่ deploy อยู่ปัจจุบันเก็บไว้ใน `.env` (ตัวแปร
`ML_SERVICE_HOST/PORT/USER/PASSWORD`) — ไฟล์นั้นไม่ถูก commit เข้า git

## Endpoints (ทุกตัวยกเว้นไม่มีเลย ต้องแนบ header `X-API-Key`)

| Endpoint | คำอธิบาย |
|---|---|
| `GET /health` | สถานะ + CPU/memory + ขนาด index — server proxy endpoint นี้ให้ dashboard top bar |
| `POST /detect` | multipart `image` → `{ detections: [{x,y,w,h,confidence}] }` |
| `POST /embed` | multipart `image` → `{ embedding: number[] }` (384 มิติ) |
| `POST /match` | json `{ embedding, topK }` → `{ candidates: [{modelId, score}] }` |
| `POST /reindex` | json `{ entries: [{imageId, modelId, imageBase64}] }` → embed ใหม่ทั้งชุด + rebuild index |

## รันบนเครื่องใหม่ (Ubuntu 22.04, CPU-only)

```sh
apt-get install -y python3-venv python3-pip libgl1 libglib2.0-0   # libgl1/libglib2.0-0: ultralytics/opencv ต้องใช้
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu
./venv/bin/pip install -r requirements.txt
```

กรอก `.env` (ดู `.env.example`) แล้วรันตรงๆ ทดสอบก่อน:

```sh
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

รันถาวรเป็น systemd service (ตัวอย่างพร้อมใช้ใน `ml-service.service` — ต้องแก้ path ให้ตรงถ้า
deploy ไปที่อื่นนอกเหนือจาก `/opt/ml-service`):

```sh
cp ml-service.service /etc/systemd/system/ml-service.service
systemctl daemon-reload
systemctl enable --now ml-service
```

## หมายเหตุสเปกเครื่อง

โมเดลที่เลือก (YOLOv8n + dinov2-small) รันบน CPU 2 core / RAM 4GB ได้สบาย ตามที่ระบุใน
spec section 12 (MVP deployment) — ถ้าจำนวนภาพอ้างอิงเพิ่มขึ้นมาก (หลักพัน+) ค่อยพิจารณาย้ายไป
เครื่องแรงขึ้นหรือใช้ GPU
