import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

INDEX_FILE = DATA_DIR / "embedding_index.npz"

# ต้องตรงกับ ML_SERVICE_API_KEY ใน server/.env — ทุก request (ยกเว้น /health) ต้องแนบ header
# X-API-Key มาด้วย เพราะเครื่องนี้เปิด public IP ตรงๆ ไม่ได้อยู่หลัง VPN/private network
API_KEY = os.environ.get("ML_SERVICE_API_KEY", "")

# ค่า default ต่ำสุดของ similarity ที่ยังถือว่า "อาจจะใช่" — ต่ำกว่านี้ไม่เอามาเป็น candidate เลย
# (ปรับได้ตามข้อมูลจริงภายหลัง ดู spec section 9)
MIN_CANDIDATE_SIMILARITY = float(os.environ.get("ML_MIN_CANDIDATE_SIMILARITY", "0.45"))

# YOLO detection confidence ขั้นต่ำสำหรับนับว่าเป็น "โทรศัพท์" ในภาพ
DETECTION_CONFIDENCE = float(os.environ.get("ML_DETECTION_CONFIDENCE", "0.35"))

# COCO class id 67 = "cell phone" (ultralytics ใช้ COCO class names มาตรฐาน)
PHONE_CLASS_NAME = "cell phone"
