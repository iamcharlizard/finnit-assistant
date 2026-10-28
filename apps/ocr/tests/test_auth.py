from __future__ import annotations

import pytest

from app.auth import check_bearer
from app.config import ConfigError, Settings

from .conftest import TOKEN, encode, render_receipt


def test_check_bearer():
    assert check_bearer(f"Bearer {TOKEN}", TOKEN)
    assert check_bearer(f"bearer {TOKEN}", TOKEN)
    assert not check_bearer(None, TOKEN)
    assert not check_bearer("", TOKEN)
    assert not check_bearer(TOKEN, TOKEN)
    assert not check_bearer(f"Basic {TOKEN}", TOKEN)
    assert not check_bearer("Bearer wrong", TOKEN)
    assert not check_bearer("Bearer ", TOKEN)


def test_refuses_to_start_without_token(monkeypatch):
    monkeypatch.delenv("OCR_SERVICE_TOKEN", raising=False)
    with pytest.raises(ConfigError):
        Settings.from_env()
    monkeypatch.setenv("OCR_SERVICE_TOKEN", "   ")
    with pytest.raises(ConfigError):
        Settings.from_env()


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("OCR_SERVICE_TOKEN", "abc")
    monkeypatch.setenv("OCR_MAX_CONCURRENCY", "2")
    settings = Settings.from_env()
    assert settings.token == "abc"
    assert settings.max_concurrency == 2
    assert settings.max_upload_bytes == 15 * 1024 * 1024
    monkeypatch.setenv("OCR_MAX_CONCURRENCY", "zero")
    with pytest.raises(ConfigError):
        Settings.from_env()


def test_health_is_public(fake_client):
    response = fake_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "engine": "rapidocr", "models": "PP-OCRv5"}


@pytest.mark.parametrize("path", ["/v1/image", "/v1/pdf"])
@pytest.mark.parametrize("header", [None, "Bearer nope", f"Token {TOKEN}"])
def test_endpoints_require_token(fake_client, path, header):
    headers = {"Authorization": header} if header else {}
    files = {"file": ("x.png", encode(render_receipt(with_qr=False), "PNG"), "image/png")}
    response = fake_client.post(path, headers=headers, files=files)
    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"
    assert response.headers["www-authenticate"] == "Bearer"
