"""Shared fixtures. Every test image is synthetic (generated here); no real receipts."""

from __future__ import annotations

import io
import os
from pathlib import Path

import numpy as np
import pytest
import qrcode
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from app.config import Settings
from app.main import create_app

TOKEN = "test-token-0123456789"
CFDI_QR = (
    "https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx"
    "?id=5803EB8D-81CD-4557-8719-26632D2FA434&re=XAXX010101000&rr=XEXX010101000"
    "&tt=000000000116.000000&fe=Q7FZ1ofA"
)
RECEIPT_LINES = [
    ("TIENDA DEMO SA DE CV", None),
    ("RFC TDE010203AB1", None),
    ("FECHA 12/10/2026 14:35", None),
    ("CAFE AMERICANO", "45.00"),
    ("PAN DULCE", "55.00"),
    ("SUBTOTAL", "100.00"),
    ("IVA", "16.00"),
    ("TOTAL", "116.00"),
]


def models_dir() -> Path:
    return Path(os.environ.get("OCR_MODELS_DIR", "/opt/models"))


def make_settings(**overrides) -> Settings:
    values = {
        "token": TOKEN,
        "models_dir": models_dir(),
        "max_concurrency": 1,
        "request_timeout_seconds": 30,
        "pdf_timeout_seconds": 120,
        "max_upload_bytes": 15 * 1024 * 1024,
        "pdf_dpi": 150,
        "pdf_default_pages": 10,
        "pdf_max_pages": 50,
        "threads": 0,
        "use_cls": True,
    }
    values.update(overrides)
    return Settings(**values)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.load_default(size=size)


def render_receipt(with_qr: bool = True, background: int | None = None) -> Image.Image:
    """A white receipt with text and, optionally, a CFDI QR code.

    With `background`, the receipt is pasted rotated a few degrees on a darker
    canvas, like a photo taken on a table.
    """
    width, line_height = 900, 64
    height = 120 + line_height * len(RECEIPT_LINES) + (420 if with_qr else 0)
    receipt = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(receipt)
    text_font = font(40)
    y = 60
    for label, amount in RECEIPT_LINES:
        draw.text((50, y), label, fill="black", font=text_font)
        if amount:
            draw.text((640, y), f"${amount}", fill="black", font=text_font)
        y += line_height
    if with_qr:
        qr = qrcode.make(CFDI_QR, box_size=4, border=2).convert("RGB")
        receipt.paste(qr, ((width - qr.width) // 2, y + 20))
    if background is None:
        return receipt
    canvas = Image.new("RGB", (int(width * 1.5), int(height * 1.35)), (background,) * 3)
    rotated = receipt.rotate(3, expand=True, fillcolor=(background,) * 3)
    canvas.paste(rotated, ((canvas.width - rotated.width) // 2, (canvas.height - rotated.height) // 2))
    return canvas


def encode(image: Image.Image, fmt: str, **kwargs) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


class FakeEngine:
    """Stands in for RapidOCR in tests that do not exercise recognition."""

    def __init__(self, delay: float = 0.0):
        self.delay = delay

    def warm_up(self) -> None:
        pass

    def segments(self, image: np.ndarray, use_cls: bool | None = None):
        if self.delay:
            import time

            time.sleep(self.delay)
        return []


@pytest.fixture(scope="session")
def real_engine():
    if not (models_dir() / "models.json").is_file():
        pytest.skip(f"OCR models not found in {models_dir()} (set OCR_MODELS_DIR)")
    from app.ocr import OcrEngine

    engine = OcrEngine(models_dir())
    engine.warm_up()
    return engine


@pytest.fixture(scope="session")
def client(real_engine):
    with TestClient(create_app(make_settings(), engine=real_engine)) as test_client:
        yield test_client


@pytest.fixture
def fake_client():
    with TestClient(create_app(make_settings(), engine=FakeEngine())) as test_client:
        yield test_client


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {TOKEN}"}
