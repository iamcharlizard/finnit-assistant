# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -t finnit-ocr:local apps/ocr
# Tests inside the image:    docker build --target test -t finnit-ocr:test apps/ocr && docker run --rm finnit-ocr:test
ARG PYTHON_IMAGE=python:3.12.14-slim-trixie@sha256:f77ac9e44ae96ef2c90b8053ea08c31f8be030f824196b0ae4db6d462c84e51f

# 1. Models: pinned URLs + sha256 (models.json), fetched at build time so the
#    container runs offline and starts without downloads.
FROM ${PYTHON_IMAGE} AS models
WORKDIR /build
COPY models.json scripts/download_models.py ./
RUN python download_models.py models.json /opt/models && cp models.json /opt/models/

# 2. Python dependencies in a virtualenv. Pinned closure, no resolver (--no-deps):
#    rapidocr declares opencv-python (GUI build) and we ship the headless one.
FROM ${PYTHON_IMAGE} AS deps
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
COPY requirements.txt /tmp/requirements.txt
# setuptools/wheel only build antlr4-python3-runtime (sdist-only, pure Python).
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install setuptools==84.0.0 wheel==0.48.0 \
 && /opt/venv/bin/pip install --no-deps --no-build-isolation -r /tmp/requirements.txt \
 && /opt/venv/bin/pip uninstall -y setuptools wheel \
 # rapidocr bundles PP-OCRv6 models we do not use (~30 MB).
 && rm -f /opt/venv/lib/python3.12/site-packages/rapidocr/models/*.onnx \
 && find /opt/venv -name '__pycache__' -prune -exec rm -rf {} + \
 && /opt/venv/bin/python -c "import cv2, onnxruntime, pypdfium2, zxingcpp, pillow_heif, rapidocr, fastapi, uvicorn"

# 3. Runtime.
FROM ${PYTHON_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/iamcharlizard/finnit-assistant" \
      org.opencontainers.image.description="Finnit OCR service (RapidOCR + PP-OCRv5, internal only)"
RUN groupadd --system --gid 10001 ocr \
 && useradd --system --uid 10001 --gid ocr --home-dir /app --shell /usr/sbin/nologin ocr
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OCR_MODELS_DIR=/opt/models \
    PORT=8090 \
    # Fewer glibc malloc arenas: steadier RSS with ONNX Runtime threads.
    MALLOC_ARENA_MAX=2
COPY --from=deps /opt/venv /opt/venv
COPY --from=models /opt/models /opt/models
WORKDIR /app
COPY app ./app
USER ocr
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8090') + '/health', timeout=4)" || exit 1
# One worker on purpose: the models are loaded once and OCR jobs are
# serialized (OCR_MAX_CONCURRENCY) to bound memory.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT}\" --workers 1 --no-access-log --timeout-graceful-shutdown 30"]

# 4. Tests (not shipped): runtime + pytest + synthetic fixtures.
FROM runtime AS test
USER root
COPY requirements-dev.txt /tmp/requirements-dev.txt
RUN pip install --no-cache-dir --no-deps -r /tmp/requirements-dev.txt
COPY pyproject.toml ./
COPY tests ./tests
USER ocr
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]

# The default target is the runtime image.
FROM runtime
