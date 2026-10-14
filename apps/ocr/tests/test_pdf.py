from __future__ import annotations

import io

from PIL import Image, ImageDraw

from .conftest import CFDI_QR, encode, font, render_receipt


def make_pdf(pages: int) -> bytes:
    images = []
    for number in range(1, pages + 1):
        page = Image.new("RGB", (1275, 1650), "white")  # Letter at 150 dpi
        draw = ImageDraw.Draw(page)
        draw.text((100, 120), f"ESTADO DE CUENTA PAGINA {number}", fill="black", font=font(36))
        draw.text((100, 200), "SALDO ANTERIOR", fill="black", font=font(32))
        draw.text((900, 200), "1,234.56", fill="black", font=font(32))
        images.append(page)
    buffer = io.BytesIO()
    images[0].save(buffer, format="PDF", save_all=True, append_images=images[1:], resolution=150)
    return buffer.getvalue()


def test_pdf_pages(client, auth):
    response = client.post("/v1/pdf", headers=auth, files={"file": ("s.pdf", make_pdf(3), "application/pdf")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"pages", "timingsMs"}
    assert set(body["timingsMs"]) == {"decode", "preprocess", "ocr", "qr", "total"}
    assert [page["page"] for page in body["pages"]] == [1, 2, 3]
    first = body["pages"][0]
    assert set(first) == {"page", "width", "height", "lines", "qr"}
    texts = [line["text"] for line in first["lines"]]
    assert any("PAGINA 1" in text for text in texts), texts
    assert any(text.startswith("SALDO ANTERIOR") and "1,234.56" in text for text in texts), texts


def test_pdf_max_pages(client, auth):
    response = client.post(
        "/v1/pdf", headers=auth, files={"file": ("s.pdf", make_pdf(3), "application/pdf")}, data={"maxPages": "1"}
    )
    assert response.status_code == 200
    assert [page["page"] for page in response.json()["pages"]] == [1]


def test_pdf_with_qr(client, auth):
    receipt = render_receipt(with_qr=True)
    buffer = io.BytesIO()
    receipt.save(buffer, format="PDF", resolution=150)
    response = client.post("/v1/pdf", headers=auth, files={"file": ("f.pdf", buffer.getvalue(), "application/pdf")})
    assert response.status_code == 200
    assert {"text": CFDI_QR, "format": "QRCode"} in response.json()["pages"][0]["qr"]


def test_pdf_invalid_max_pages(fake_client, auth):
    for value in ("0", "abc", "1000"):
        response = fake_client.post(
            "/v1/pdf", headers=auth, files={"file": ("s.pdf", make_pdf(1), "application/pdf")}, data={"maxPages": value}
        )
        assert response.status_code == 400
        assert response.json()["error"] == "invalid_max_pages"


def test_pdf_rejects_images_and_corrupt_files(fake_client, auth):
    png = encode(render_receipt(with_qr=False), "PNG")
    response = fake_client.post("/v1/pdf", headers=auth, files={"file": ("x.pdf", png, "application/pdf")})
    assert response.status_code == 415
    response = fake_client.post(
        "/v1/pdf", headers=auth, files={"file": ("x.pdf", b"%PDF-1.7\ngarbage", "application/pdf")}
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_pdf"
