"""Object detection: หาตำแหน่งโทรศัพท์ในภาพที่วางเรียงบนโต๊ะ/ถาด (flat-lay)

ใช้ YOLOv8n (pretrained บน COCO) แบบ zero-shot — ไม่ต้อง train เพิ่ม เพราะ COCO มีคลาส
"cell phone" อยู่แล้ว และภาพ flat-lay แสงปกติเป็นเคสที่ตรวจจับได้แม่นยำโดยไม่ต้อง fine-tune
"""

from io import BytesIO

from PIL import Image
from ultralytics import YOLO

from .config import DETECTION_CONFIDENCE, PHONE_CLASS_NAME

_model = None


def load_detector():
    global _model
    if _model is None:
        # ดาวน์โหลดน้ำหนักโมเดล (~6MB) อัตโนมัติครั้งแรกที่รัน แล้ว cache ไว้ใน ~/.cache
        _model = YOLO("yolov8n.pt")
    return _model


def detect_phones(image_bytes: bytes) -> list[dict]:
    """คืน list ของ {x, y, w, h, confidence} เป็นพิกเซลจริงบนภาพต้นฉบับ"""
    model = load_detector()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    results = model.predict(image, conf=DETECTION_CONFIDENCE, verbose=False)
    names = results[0].names

    detections = []
    for box in results[0].boxes:
        class_id = int(box.cls[0])
        if names.get(class_id) != PHONE_CLASS_NAME:
            continue
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        detections.append(
            {
                "x": round(x1),
                "y": round(y1),
                "w": round(x2 - x1),
                "h": round(y2 - y1),
                "confidence": round(float(box.conf[0]), 4),
            }
        )
    return detections
