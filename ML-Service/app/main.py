import time
import base64
import logging

import psutil
from fastapi import FastAPI, Header, UploadFile, HTTPException
from pydantic import BaseModel

from .config import API_KEY
from .detector import detect_phones, load_detector
from .embedder import embed_image, load_embedder
from .index_store import match, load_from_disk, index_size, rebuild_index

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

app = FastAPI(title="Inspect ML-Service", version="1.0.0")

_started_at = time.time()
_last_request_at: float | None = None
_request_count = 0


def require_api_key(x_api_key: str = Header(default="")):
    if not API_KEY:
        # ยังไม่ได้ตั้งค่า API key ใน .env — บล็อกทุก request เพื่อกันลืมตั้งค่าแล้วเปิดสาธารณะเปล่าๆ
        raise HTTPException(500, "ML_SERVICE_API_KEY not configured on server")
    if x_api_key != API_KEY:
        raise HTTPException(401, "invalid or missing X-API-Key")


@app.on_event("startup")
def on_startup():
    logger.info("Loading models...")
    load_detector()
    load_embedder()
    load_from_disk()
    logger.info("Models loaded, index size=%d", index_size())


def _track_request():
    global _last_request_at, _request_count
    _last_request_at = time.time()
    _request_count += 1


@app.get("/health")
def health(x_api_key: str = Header(default="")):
    require_api_key(x_api_key)
    return {
        "status": "ok",
        "uptimeSeconds": round(time.time() - _started_at),
        "indexSize": index_size(),
        "requestCount": _request_count,
        "lastRequestAt": _last_request_at,
        "cpuPercent": psutil.cpu_percent(interval=0.1),
        "memoryPercent": psutil.virtual_memory().percent,
    }


@app.post("/detect")
async def detect(image: UploadFile, x_api_key: str = Header(default="")):
    require_api_key(x_api_key)
    _track_request()
    image_bytes = await image.read()
    detections = detect_phones(image_bytes)
    return {"detections": detections}


@app.post("/embed")
async def embed(image: UploadFile, x_api_key: str = Header(default="")):
    require_api_key(x_api_key)
    _track_request()
    image_bytes = await image.read()
    vector = embed_image(image_bytes)
    return {"embedding": vector.tolist()}


class MatchBody(BaseModel):
    embedding: list[float]
    topK: int = 5


@app.post("/match")
def match_endpoint(body: MatchBody, x_api_key: str = Header(default="")):
    require_api_key(x_api_key)
    _track_request()
    import numpy as np

    candidates = match(np.array(body.embedding, dtype=np.float32), top_k=body.topK)
    return {"candidates": candidates}


class ReindexEntry(BaseModel):
    imageId: int
    modelId: int
    imageBase64: str


class ReindexBody(BaseModel):
    entries: list[ReindexEntry]


@app.post("/reindex")
def reindex(body: ReindexBody, x_api_key: str = Header(default="")):
    require_api_key(x_api_key)
    _track_request()

    built = []
    failed = []
    for entry in body.entries:
        try:
            image_bytes = base64.b64decode(entry.imageBase64)
            vector = embed_image(image_bytes)
            built.append({"imageId": entry.imageId, "modelId": entry.modelId, "vector": vector.tolist()})
        except Exception as exc:  # noqa: BLE001 — บันทึกไว้ report กลับ ไม่ทำให้ทั้ง batch ล้ม
            failed.append({"imageId": entry.imageId, "error": str(exc)})

    rebuild_index(built)
    return {"indexed": len(built), "failed": failed}
