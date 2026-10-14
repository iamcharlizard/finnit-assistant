from __future__ import annotations

import io
import re

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import create_app

from .conftest import CFDI_QR, FakeEngine, encode, make_settings, render_receipt


def all_text(body: dict) -> str:
    return "\n".join(line["text"] for line in body["lines"])


def assert_contract(body: dict) -> None:
    assert set(body) == {"width", "height", "lines", "qr", "timingsMs"}
    assert isinstance(body["width"], int) and isinstance(body["height"], int)
    assert set(body["timingsMs"]) == {"decode", "preprocess", "ocr", "qr", "total"}
    assert all(isinstance(value, int) for value in body["timingsMs"].values())
    for line in body["lines"]:
        assert set(line) == {"text", "confidence", "box"}
        assert isinstance(line["text"], str) and 0 <= line["confidence"] <= 1
        assert len(line["box"]) == 4 and all(len(point) == 2 for point in line["box"])
    for code in body["qr"]:
        assert set(code) == {"text", "format"}


def test_receipt_png_lines_and_qr(client, auth):
    data = encode(render_receipt(with_qr=True), "PNG")
    response = client.post("/v1/image", headers=auth, files={"file": ("r.png", data, "image/png")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert_contract(body)
    text = all_text(body)
    assert re.search(r"^TOTAL\s+\$?116[.,]00$", text, re.MULTILINE), text
    assert "12/10/2026" in text
    assert "TDE010203AB1" in text.replace(" ", "")
    assert {"text": CFDI_QR, "format": "QRCode"} in body["qr"]
    # Reading order: top to bottom.
    tops = [line["box"][0][1] for line in body["lines"]]
    assert tops == sorted(tops)
    labels = [line["text"].split()[0] for line in body["lines"]]
    assert labels.index("SUBTOTAL") < labels.index("IVA") < labels.index("TOTAL")


def test_photo_like_jpeg_with_exif_rotation(client, auth):
    """A photo on a dark table, stored rotated with an EXIF orientation tag."""
    photo = render_receipt(with_qr=False, background=60)
    # Store the pixels rotated 90° and tag Orientation=6 ("rotate 90 CW to view").
    stored = photo.transpose(Image.Transpose.ROTATE_90)
    exif = Image.Exif()
    exif[0x0112] = 6
    data = encode(stored, "JPEG", quality=92, exif=exif.tobytes())
    response = client.post("/v1/image", headers=auth, files={"file": ("p.jpg", data, "image/jpeg")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert_contract(body)
    # The synthetic receipt is landscape (900x632); the stored pixels are
    # portrait, so a landscape result means the EXIF rotation was applied.
    assert body["width"] > body["height"]
    assert max(body["width"], body["height"]) <= 1600
    assert re.search(r"TOTAL\s+\$?116[.,]00", all_text(body)), all_text(body)


@pytest.mark.parametrize("fmt,mime", [("WEBP", "image/webp"), ("HEIF", "image/heic")])
def test_other_formats(client, auth, fmt, mime):
    data = encode(render_receipt(with_qr=False), fmt, quality=90)
    response = client.post("/v1/image", headers=auth, files={"file": ("r", data, mime)})
    assert response.status_code == 200, response.text
    assert "TOTAL" in all_text(response.json())


def test_rejects_non_images(fake_client, auth):
    for payload in (b"hello world", b"%PDF-1.7\n..."):
        response = fake_client.post("/v1/image", headers=auth, files={"file": ("x.jpg", payload, "image/jpeg")})
        assert response.status_code == 415
        assert response.json()["error"] == "unsupported_media_type"


def test_corrupt_image(fake_client, auth):
    data = b"\xff\xd8\xff\xe0" + b"\x00" * 100
    response = fake_client.post("/v1/image", headers=auth, files={"file": ("x.jpg", data, "image/jpeg")})
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_image"


def test_missing_file_and_wrong_content_type(fake_client, auth):
    response = fake_client.post("/v1/image", headers=auth, data={"other": "1"})
    assert response.status_code == 400
    assert response.json()["error"] in {"missing_file", "invalid_request"}
    response = fake_client.post(
        "/v1/image",
        headers=auth,
        content=b"{}",
    )
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_request"


def test_file_too_large(auth):
    settings = make_settings(max_upload_bytes=1024 * 1024)
    with TestClient(create_app(settings, engine=FakeEngine())) as small_client:
        big = b"\xff\xd8\xff" + b"\x00" * (2 * 1024 * 1024)
        response = small_client.post("/v1/image", headers=auth, files={"file": ("x.jpg", big, "image/jpeg")})
        assert response.status_code == 413
        assert response.json()["error"] == "payload_too_large"
        # Just over the limit but within the multipart allowance: caught after reading.
        slightly = b"\xff\xd8\xff" + b"\x00" * (1024 * 1024)
        response = small_client.post("/v1/image", headers=auth, files={"file": ("x.jpg", slightly, "image/jpeg")})
        assert response.status_code == 413


def test_unknown_route_is_json(fake_client):
    response = fake_client.get("/nope")
    assert response.status_code == 404
    assert response.json()["error"] == "not_found"


def test_timeout_returns_504(auth):
    settings = make_settings(request_timeout_seconds=1)
    with TestClient(create_app(settings, engine=FakeEngine(delay=2.5))) as slow_client:
        data = encode(render_receipt(with_qr=False), "PNG")
        response = slow_client.post("/v1/image", headers=auth, files={"file": ("r.png", data, "image/png")})
        assert response.status_code == 504
        assert response.json()["error"] == "timeout"


def test_tiny_image_is_upscaled(fake_client, auth):
    data = encode(Image.new("RGB", (300, 200), "white"), "PNG")
    response = fake_client.post("/v1/image", headers=auth, files={"file": ("t.png", data, "image/png")})
    assert response.status_code == 200
    body = response.json()
    assert (body["width"], body["height"]) == (600, 400)
    assert body["lines"] == [] and body["qr"] == []


def test_decompression_bomb(fake_client, auth):
    buffer = io.BytesIO()
    Image.new("1", (9000, 9000)).save(buffer, format="PNG")
    response = fake_client.post("/v1/image", headers=auth, files={"file": ("b.png", buffer.getvalue(), "image/png")})
    assert response.status_code == 413
    assert response.json()["error"] == "image_too_large"
