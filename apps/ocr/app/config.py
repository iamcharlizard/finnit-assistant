"""Settings read from the environment once at startup."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(RuntimeError):
    """Raised when the service cannot start with the current environment."""


def _int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ConfigError(f"{name} must be an integer, got {raw!r}") from error
    if not minimum <= value <= maximum:
        raise ConfigError(f"{name} must be between {minimum} and {maximum}, got {value}")
    return value


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    token: str
    models_dir: Path
    max_concurrency: int
    request_timeout_seconds: int
    pdf_timeout_seconds: int
    max_upload_bytes: int
    pdf_dpi: int
    pdf_default_pages: int
    pdf_max_pages: int
    threads: int
    use_cls: bool

    @classmethod
    def from_env(cls) -> Settings:
        token = os.environ.get("OCR_SERVICE_TOKEN", "").strip()
        if not token:
            raise ConfigError("OCR_SERVICE_TOKEN is not set; refusing to start without authentication")
        return cls(
            token=token,
            models_dir=Path(os.environ.get("OCR_MODELS_DIR", "/opt/models")),
            max_concurrency=_int("OCR_MAX_CONCURRENCY", 1, 1, 16),
            request_timeout_seconds=_int("OCR_REQUEST_TIMEOUT_SECONDS", 30, 1, 600),
            # PDFs take seconds per page (see docs/document-ocr.md, Phase 0).
            pdf_timeout_seconds=_int("OCR_PDF_TIMEOUT_SECONDS", 300, 1, 3600),
            max_upload_bytes=_int("OCR_MAX_UPLOAD_MB", 15, 1, 100) * 1024 * 1024,
            pdf_dpi=_int("OCR_PDF_DPI", 200, 72, 400),
            pdf_default_pages=10,
            pdf_max_pages=_int("OCR_PDF_MAX_PAGES", 50, 1, 500),
            # ONNX Runtime intra-op threads; 0 lets it use every core.
            threads=_int("OCR_THREADS", 0, 0, 64),
            use_cls=_bool("OCR_USE_CLS", True),
        )
