"""In-memory embedding index ของภาพอ้างอิงทุกรุ่น + persist ลงดิสก์ (npz)

ตั้งใจให้ ML-Service ไม่ต้องคุยกับ MySQL เอง (Node เป็นตัวกลางเสมอตาม spec) — Node ส่งรายการ
ภาพอ้างอิงที่ active ทั้งหมดมาให้ตอน /reindex แล้วเก็บพักไว้ในหน่วยความจำ + เขียนสำรองไว้ที่ดิสก์
กันเซอร์วิสรีสตาร์ทแล้วข้อมูลหาย (โหลดจากไฟล์นี้กลับมาตอน startup โดยยังไม่ต้องรอ Node เรียก reindex ใหม่)
"""

import threading

import numpy as np

from .config import INDEX_FILE, MIN_CANDIDATE_SIMILARITY

_lock = threading.Lock()

# แต่ละแถว: image_id (int), model_id (int), vector (np.ndarray[float32])
_image_ids: list[int] = []
_model_ids: list[int] = []
_vectors: np.ndarray | None = None  # shape (N, dim)


def load_from_disk():
    global _image_ids, _model_ids, _vectors
    if not INDEX_FILE.exists():
        return
    with _lock:
        data = np.load(INDEX_FILE)
        _image_ids = data["image_ids"].tolist()
        _model_ids = data["model_ids"].tolist()
        _vectors = data["vectors"]


def _save_to_disk():
    if _vectors is None:
        np.savez(INDEX_FILE, image_ids=np.array([]), model_ids=np.array([]), vectors=np.zeros((0, 0)))
        return
    np.savez(
        INDEX_FILE,
        image_ids=np.array(_image_ids),
        model_ids=np.array(_model_ids),
        vectors=_vectors,
    )


def rebuild_index(entries: list[dict]):
    """entries: [{imageId, modelId, vector: list[float]}] — แทนที่ index ทั้งชุด"""
    global _image_ids, _model_ids, _vectors
    with _lock:
        _image_ids = [e["imageId"] for e in entries]
        _model_ids = [e["modelId"] for e in entries]
        _vectors = np.array([e["vector"] for e in entries], dtype=np.float32) if entries else None
        _save_to_disk()


def index_size() -> int:
    return len(_image_ids)


def match(vector: np.ndarray, top_k: int = 5) -> list[dict]:
    """คืน top_k รุ่น เรียงตาม similarity สูงสุดของภาพอ้างอิงที่ใกล้เคียงที่สุดในรุ่นนั้น"""
    with _lock:
        if _vectors is None or len(_image_ids) == 0:
            return []
        vectors = _vectors
        model_ids = list(_model_ids)

    # vector ถูก normalize มาแล้วตอน embed — dot product ตรงๆ คือ cosine similarity
    similarities = vectors @ vector

    best_per_model: dict[int, float] = {}
    for model_id, score in zip(model_ids, similarities):
        score = float(score)
        if model_id not in best_per_model or score > best_per_model[model_id]:
            best_per_model[model_id] = score

    ranked = sorted(best_per_model.items(), key=lambda kv: kv[1], reverse=True)
    candidates = [
        {"modelId": model_id, "score": round(score, 4)}
        for model_id, score in ranked
        if score >= MIN_CANDIDATE_SIMILARITY
    ]
    return candidates[:top_k]
