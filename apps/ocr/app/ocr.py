"""RapidOCR engine (PP-OCRv5 ONNX models) and reading-order line assembly."""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

logger = logging.getLogger("ocr.engine")

MODELS_VERSION = "PP-OCRv5"


@dataclass
class Segment:
    text: str
    confidence: float
    box: np.ndarray  # (4, 2) float: tl, tr, br, bl


def load_manifest(models_dir: Path) -> dict[str, Path]:
    """Model paths by role (det, cls, rec). Reads models.json copied next to the models."""
    manifest_path = models_dir / "models.json"
    manifest = json.loads(manifest_path.read_text())
    paths = {role: models_dir / info["file"] for role, info in manifest["models"].items()}
    missing = [str(path) for path in paths.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"OCR models missing: {', '.join(missing)}")
    return paths


class OcrEngine:
    """Thin wrapper over RapidOCR. Not thread-safe: callers serialize access."""

    def __init__(self, models_dir: Path, threads: int = 0, use_cls: bool = True):
        from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR

        paths = load_manifest(models_dir)
        ort_threads = threads if threads > 0 else -1
        params = {
            "Global.log_level": "warning",
            "Global.use_cls": use_cls,
            "Global.model_root_dir": str(models_dir),
            "EngineConfig.onnxruntime.intra_op_num_threads": ort_threads,
            "EngineConfig.onnxruntime.inter_op_num_threads": 1,
            "EngineConfig.onnxruntime.enable_cpu_mem_arena": False,
            "Det.engine_type": EngineType.ONNXRUNTIME,
            "Det.lang_type": LangDet.CH,
            "Det.model_type": ModelType.MOBILE,
            "Det.ocr_version": OCRVersion.PPOCRV5,
            "Det.model_path": str(paths["det"]),
            "Cls.engine_type": EngineType.ONNXRUNTIME,
            "Cls.model_type": ModelType.MOBILE,
            "Cls.ocr_version": OCRVersion.PPOCRV5,
            "Cls.model_path": str(paths["cls"]),
            "Rec.engine_type": EngineType.ONNXRUNTIME,
            "Rec.lang_type": LangRec.LATIN,
            "Rec.model_type": ModelType.MOBILE,
            "Rec.ocr_version": OCRVersion.PPOCRV5,
            "Rec.model_path": str(paths["rec"]),
        }
        self._engine = RapidOCR(params=params)
        self.use_cls = use_cls

    def warm_up(self) -> None:
        """Runs one tiny inference so the first real request is not slower."""
        canvas = np.full((64, 256, 3), 255, dtype=np.uint8)
        import cv2

        cv2.putText(canvas, "TOTAL 10.00", (8, 44), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
        self.segments(canvas)

    def segments(self, image: np.ndarray, use_cls: bool | None = None) -> list[Segment]:
        """Detects and recognizes text. `use_cls=False` skips the text-line
        orientation classifier (rendered PDF pages are always upright)."""
        # RapidOCR keeps per-call flags as state, so always pass it explicitly.
        cls = self.use_cls if use_cls is None else (use_cls and self.use_cls)
        result = self._engine(image, use_cls=cls)
        if result.boxes is None or result.txts is None:
            return []
        out: list[Segment] = []
        for box, text, score in zip(result.boxes, result.txts, result.scores):
            text = text.strip()
            if text:
                out.append(Segment(text=text, confidence=float(score), box=np.asarray(box, dtype=np.float32)))
        return out


def _dominant_angle(segments: list[Segment]) -> float:
    """Median baseline angle (radians) of the wider segments; 0 if unclear."""
    angles = []
    for seg in segments:
        tl, tr = seg.box[0], seg.box[1]
        dx, dy = float(tr[0] - tl[0]), float(tr[1] - tl[1])
        if dx > 2 * abs(seg.box[3][1] - seg.box[0][1]) and dx > 0:
            angles.append(math.atan2(dy, dx))
    if len(angles) < 3:
        return 0.0
    angle = float(np.median(angles))
    return angle if abs(angle) < math.radians(15) else 0.0


def assemble_lines(segments: list[Segment]) -> list[dict]:
    """Groups segments into visual lines in reading order.

    Segments on the same row (e.g. "TOTAL" and "$123.45" on a receipt, or the
    columns of a statement row) become one line joined with spaces, ordered
    left to right; lines go top to bottom. Rows are compared after undoing the
    dominant tilt, so a slightly rotated photo still groups correctly. The
    returned box is the axis-aligned bounding quad of the row's segments, in
    the coordinates of the image that was OCR'd; confidence is the
    length-weighted mean of the segments.
    """
    if not segments:
        return []
    angle = _dominant_angle(segments)
    cos, sin = math.cos(-angle), math.sin(-angle)

    items = []
    for seg in segments:
        xs = seg.box[:, 0]
        ys = seg.box[:, 1]
        # Rotate into the deskewed frame for grouping only.
        rx = xs * cos - ys * sin
        ry = xs * sin + ys * cos
        items.append({"seg": seg, "x0": float(rx.min()), "y0": float(ry.min()), "y1": float(ry.max())})
    items.sort(key=lambda item: (item["y0"] + item["y1"]) / 2)

    rows: list[list[dict]] = []
    for item in items:
        height = item["y1"] - item["y0"]
        center = (item["y0"] + item["y1"]) / 2
        placed = False
        for row in reversed(rows[-3:]):
            row_y0 = float(np.median([r["y0"] for r in row]))
            row_y1 = float(np.median([r["y1"] for r in row]))
            row_center = (row_y0 + row_y1) / 2
            overlap = min(item["y1"], row_y1) - max(item["y0"], row_y0)
            min_height = max(1.0, min(height, row_y1 - row_y0))
            if overlap / min_height >= 0.5 and abs(center - row_center) < 0.6 * min_height:
                row.append(item)
                placed = True
                break
        if not placed:
            rows.append([item])

    rows.sort(key=lambda row: float(np.median([(r["y0"] + r["y1"]) / 2 for r in row])))
    lines = []
    for row in rows:
        row.sort(key=lambda r: r["x0"])
        segs = [r["seg"] for r in row]
        text = " ".join(s.text for s in segs)
        weights = [max(1, len(s.text)) for s in segs]
        confidence = sum(s.confidence * w for s, w in zip(segs, weights)) / sum(weights)
        points = np.concatenate([s.box for s in segs])
        x0, y0 = points.min(axis=0)
        x1, y1 = points.max(axis=0)
        box = [
            [round(float(x0), 1), round(float(y0), 1)],
            [round(float(x1), 1), round(float(y0), 1)],
            [round(float(x1), 1), round(float(y1), 1)],
            [round(float(x0), 1), round(float(y1), 1)],
        ]
        lines.append({"text": text, "confidence": round(float(confidence), 4), "box": box})
    return lines
