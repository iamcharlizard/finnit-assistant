"""HTTP API of the OCR service (internal only; see apps/ocr/README.md).

GET  /health    → {"status":"ok","engine":"rapidocr","models":"PP-OCRv5"}
POST /v1/image  → OCR + barcodes of a receipt photo (JPEG, PNG, WEBP, HEIC)
POST /v1/pdf    → OCR + barcodes per page of a PDF

Every endpoint except /health needs `Authorization: Bearer <OCR_SERVICE_TOKEN>`.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from . import pdf as pdf_mod
from .auth import require_token
from .config import Settings
from .errors import ApiError, payload_too_large, unsupported_media_type
from .ocr import MODELS_VERSION, OcrEngine, assemble_lines
from .preprocess import (
    ImageDecodeError,
    ImageTooLargeError,
    decode_image,
    detect_image_type,
    is_pdf,
    preprocess_receipt,
)
from .qr import decode_barcodes

logger = logging.getLogger("ocr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# Multipart framing on top of the file itself.
MULTIPART_OVERHEAD = 64 * 1024


def _ms(seconds: float) -> int:
    return round(seconds * 1000)


class Cancelled(Exception):
    """A job noticed that its request already timed out."""


class BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    """Rejects request bodies above the limit before they are parsed or spooled.

    Checks Content-Length up front and also counts streamed bytes, so chunked
    uploads without a length cannot get past the limit.
    """

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = self.max_bytes + MULTIPART_OVERHEAD
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    too_large = int(value) > limit
                except ValueError:
                    too_large = False
                if too_large:
                    await self._reject(scope, send)
                    return

        received = 0
        started = False

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except BodyTooLarge:
            if not started:
                await self._reject(scope, send)

    async def _reject(self, scope: Scope, send: Send) -> None:
        response = JSONResponse(payload_too_large(self.max_bytes).body(), status_code=413)
        await response(scope, _empty_receive, send)


async def _empty_receive() -> Message:  # pragma: no cover - never awaited by JSONResponse
    return {"type": "http.disconnect"}


class JobRunner:
    """Runs OCR jobs in worker threads, at most `max_concurrency` at a time.

    The whole request (waiting for a slot + running) has a deadline. A job that
    times out keeps its slot until its thread really finishes, so a slow job can
    never push memory above the configured concurrency.
    """

    def __init__(self, max_concurrency: int, queue_timeout_seconds: float):
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.queue_timeout = queue_timeout_seconds

    def _release(self, future: asyncio.Future) -> None:
        self.semaphore.release()
        if not future.cancelled():
            future.exception()  # mark as retrieved: a timed-out job's error is expected

    async def run(self, job: Callable[[threading.Event], Any], timeout: float) -> Any:
        deadline = time.monotonic() + timeout
        try:
            await asyncio.wait_for(self.semaphore.acquire(), timeout=min(timeout, self.queue_timeout))
        except TimeoutError as error:
            raise ApiError(503, "busy", "The OCR service is busy; retry later") from error

        cancel = threading.Event()
        loop = asyncio.get_running_loop()
        future = loop.run_in_executor(None, job, cancel)
        future.add_done_callback(self._release)
        remaining = max(0.1, deadline - time.monotonic())
        try:
            return await asyncio.wait_for(asyncio.shield(future), timeout=remaining)
        except TimeoutError as error:
            cancel.set()
            raise ApiError(504, "timeout", f"OCR did not finish within {int(timeout)} s") from error
        except Cancelled as error:  # pragma: no cover - only after the deadline
            raise ApiError(504, "timeout", f"OCR did not finish within {int(timeout)} s") from error


async def _read_upload(request: Request, max_bytes: int) -> tuple[bytes, dict[str, Any]]:
    """Returns the bytes of the multipart `file` field and the other form fields."""
    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("multipart/form-data"):
        raise ApiError(400, "invalid_request", "Expected multipart/form-data with a `file` field")
    try:
        form = await request.form(max_files=1, max_fields=10)
    except BodyTooLarge:
        raise
    except Exception as error:
        raise ApiError(400, "invalid_request", "Malformed multipart body") from error
    try:
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise ApiError(400, "missing_file", "Multipart field `file` is required")
        data = await upload.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise payload_too_large(max_bytes)
        if not data:
            raise ApiError(400, "empty_file", "The uploaded file is empty")
        fields = {key: value for key, value in form.items() if key != "file" and isinstance(value, str)}
        return data, fields
    finally:
        await form.close()


def create_app(settings: Settings | None = None, engine: OcrEngine | None = None) -> FastAPI:
    # Fails fast (and the process exits) when OCR_SERVICE_TOKEN is missing.
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if app.state.engine is None:
            started = time.perf_counter()
            app.state.engine = OcrEngine(settings.models_dir, threads=settings.threads, use_cls=settings.use_cls)
            app.state.engine.warm_up()
            logger.info("models loaded (%s) in %d ms", MODELS_VERSION, _ms(time.perf_counter() - started))
        # A request waits for a free slot at most OCR_REQUEST_TIMEOUT_SECONDS (then 503 busy).
        app.state.runner = JobRunner(settings.max_concurrency, settings.request_timeout_seconds)
        app.state.ready = True
        yield
        app.state.ready = False

    app = FastAPI(
        title="Finnit OCR",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.ready = False
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_upload_bytes)

    @app.exception_handler(ApiError)
    async def api_error_handler(_: Request, error: ApiError) -> JSONResponse:
        return JSONResponse(error.body(), status_code=error.status, headers=error.headers)

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, error: StarletteHTTPException) -> JSONResponse:
        codes = {404: "not_found", 405: "method_not_allowed"}
        code = codes.get(error.status_code, "http_error")
        return JSONResponse({"error": code, "message": str(error.detail)}, status_code=error.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, error: RequestValidationError) -> JSONResponse:
        return JSONResponse({"error": "invalid_request", "message": "Invalid request"}, status_code=400)

    @app.exception_handler(Exception)
    async def unexpected_error_handler(_: Request, error: Exception) -> JSONResponse:
        logger.exception("unexpected error")
        return JSONResponse({"error": "internal_error", "message": "Unexpected error"}, status_code=500)

    @app.get("/health")
    async def health() -> JSONResponse:
        if not app.state.ready or app.state.engine is None:
            return JSONResponse({"status": "loading", "engine": "rapidocr", "models": MODELS_VERSION}, status_code=503)
        return JSONResponse({"status": "ok", "engine": "rapidocr", "models": MODELS_VERSION})

    @app.post("/v1/image", dependencies=[Depends(require_token)])
    async def ocr_image(request: Request) -> JSONResponse:
        data, _ = await _read_upload(request, settings.max_upload_bytes)
        kind = detect_image_type(data)
        if kind is None:
            raise unsupported_media_type("a JPEG, PNG, WEBP or HEIC image")
        engine: OcrEngine = app.state.engine

        def job(cancel: threading.Event) -> dict[str, Any]:
            t0 = time.perf_counter()
            original = decode_image(data)
            t1 = time.perf_counter()
            if cancel.is_set():
                raise Cancelled()
            prepared = preprocess_receipt(original)
            t2 = time.perf_counter()
            if cancel.is_set():
                raise Cancelled()
            lines = assemble_lines(engine.segments(prepared.image))
            t3 = time.perf_counter()
            qr = decode_barcodes(original, prepared.image)
            t4 = time.perf_counter()
            height, width = prepared.image.shape[:2]
            logger.info(
                "image %s %dx%d cropped=%s lines=%d qr=%d decode=%dms preprocess=%dms ocr=%dms qr=%dms",
                kind, width, height, prepared.cropped, len(lines), len(qr),
                _ms(t1 - t0), _ms(t2 - t1), _ms(t3 - t2), _ms(t4 - t3),
            )  # fmt: skip
            return {
                "width": int(width),
                "height": int(height),
                "lines": lines,
                "qr": qr,
                "timingsMs": {
                    "decode": _ms(t1 - t0),
                    "preprocess": _ms(t2 - t1),
                    "ocr": _ms(t3 - t2),
                    "qr": _ms(t4 - t3),
                    "total": _ms(t4 - t0),
                },
            }

        try:
            result = await app.state.runner.run(job, settings.request_timeout_seconds)
        except ImageTooLargeError as error:
            raise ApiError(413, "image_too_large", "The image has too many pixels") from error
        except ImageDecodeError as error:
            raise ApiError(422, "invalid_image", "The image could not be decoded") from error
        return JSONResponse(result)

    @app.post("/v1/pdf", dependencies=[Depends(require_token)])
    async def ocr_pdf(request: Request) -> JSONResponse:
        data, fields = await _read_upload(request, settings.max_upload_bytes)
        if not is_pdf(data):
            raise unsupported_media_type("a PDF")
        raw_pages = fields.get("maxPages")
        max_pages = settings.pdf_default_pages
        if raw_pages not in (None, ""):
            try:
                max_pages = int(raw_pages)
            except ValueError as error:
                raise ApiError(400, "invalid_max_pages", "maxPages must be an integer") from error
            if not 1 <= max_pages <= settings.pdf_max_pages:
                raise ApiError(400, "invalid_max_pages", f"maxPages must be between 1 and {settings.pdf_max_pages}")
        engine: OcrEngine = app.state.engine

        def job(cancel: threading.Event) -> dict[str, Any]:
            timings = {"decode": 0.0, "preprocess": 0.0, "ocr": 0.0, "qr": 0.0}
            t_start = time.perf_counter()
            doc = pdf_mod.open_pdf(data)
            pages = []
            try:
                t0 = time.perf_counter()
                for number, image in pdf_mod.render_pages(doc, settings.pdf_dpi, max_pages):
                    t1 = time.perf_counter()
                    timings["decode"] += t1 - t0
                    if cancel.is_set():
                        raise Cancelled()
                    lines = assemble_lines(engine.segments(image, use_cls=False))
                    t2 = time.perf_counter()
                    qr = decode_barcodes(image)
                    t3 = time.perf_counter()
                    timings["ocr"] += t2 - t1
                    timings["qr"] += t3 - t2
                    height, width = image.shape[:2]
                    pages.append({"page": number, "width": int(width), "height": int(height), "lines": lines, "qr": qr})
                    del image
                    t0 = time.perf_counter()
            finally:
                doc.close()
            total = time.perf_counter() - t_start
            result_timings = {key: _ms(value) for key, value in timings.items()}
            result_timings["total"] = _ms(total)
            logger.info(
                "pdf pages=%d decode=%dms ocr=%dms qr=%dms total=%dms",
                len(pages), result_timings["decode"], result_timings["ocr"], result_timings["qr"], result_timings["total"],
            )  # fmt: skip
            return {"pages": pages, "timingsMs": result_timings}

        try:
            result = await app.state.runner.run(job, settings.pdf_timeout_seconds)
        except pdf_mod.PdfError as error:
            raise ApiError(422, "invalid_pdf", "The PDF could not be opened (corrupt or password-protected)") from error
        return JSONResponse(result)

    return app


def __getattr__(name: str) -> Any:
    # `uvicorn app.main:app` builds the app lazily so tests can import this
    # module without OCR_SERVICE_TOKEN or the models.
    if name == "app":
        global app
        app = create_app()
        return app
    raise AttributeError(name)
