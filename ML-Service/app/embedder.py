"""Image embedding: แปลงภาพ (ทั้งภาพอ้างอิงตอนเทรน และภาพ crop ตอน match) เป็น vector
เดียวกัน ใช้ DINOv2-small (pretrained, self-supervised) — ไม่ต้อง finetune เพิ่มตาม spec
"""

from io import BytesIO

import torch
import numpy as np
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

_MODEL_NAME = "facebook/dinov2-small"

_processor = None
_model = None


def load_embedder():
    global _processor, _model
    if _model is None:
        _processor = AutoImageProcessor.from_pretrained(_MODEL_NAME)
        _model = AutoModel.from_pretrained(_MODEL_NAME)
        _model.eval()
    return _processor, _model


@torch.inference_mode()
def embed_image(image_bytes: bytes) -> np.ndarray:
    processor, model = load_embedder()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    inputs = processor(images=image, return_tensors="pt")
    outputs = model(**inputs)
    # CLS token ของ layer สุดท้าย = ตัวแทนภาพทั้งภาพ (มาตรฐานของ DINOv2 สำหรับงาน retrieval)
    cls_embedding = outputs.last_hidden_state[:, 0, :].squeeze(0).numpy()

    # normalize เป็น unit vector ไว้ล่วงหน้า เพื่อให้ cosine similarity ตอน match เหลือแค่ dot product
    norm = np.linalg.norm(cls_embedding)
    if norm > 0:
        cls_embedding = cls_embedding / norm
    return cls_embedding.astype(np.float32)
