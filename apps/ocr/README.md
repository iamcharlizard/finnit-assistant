# Servicio OCR (`apps/ocr`)

Servicio interno que lee fotos de tickets y PDFs escaneados: **RapidOCR** con los modelos **PP-OCRv5** (ONNX Runtime, CPU), preprocesado con OpenCV, PDFs con `pypdfium2` y QR/códigos de barras con `zxing-cpp`. Solo lo llama la API de Finnit, por la red interna; no tiene dominio público. Diseño y resultados: [`docs/document-ocr.md`](../../docs/document-ocr.md). Despliegue: [`docs/deployment.md`](../../docs/deployment.md#ocr-servicio-interno).

Es Python, no un paquete del workspace de pnpm (no tiene `package.json`), así que pnpm y turbo lo ignoran.

## Contrato HTTP

Todos los endpoints salvo `/health` exigen `Authorization: Bearer <OCR_SERVICE_TOKEN>` (comparación en tiempo constante; si falta o no coincide: `401`). Sin `OCR_SERVICE_TOKEN` el servicio no arranca.

| Método y ruta | Entrada | Respuesta |
|---|---|---|
| `GET /health` | — | `{"status":"ok","engine":"rapidocr","models":"PP-OCRv5"}` (200 solo con los modelos cargados) |
| `POST /v1/image` | multipart `file`: JPEG, PNG, WEBP o HEIC, máx. 15 MB | `{"width","height","lines":[{"text","confidence","box"}],"qr":[{"text","format"}],"timingsMs":{"decode","preprocess","ocr","qr","total"}}` |
| `POST /v1/pdf` | multipart `file` (PDF, máx. 15 MB) y `maxPages` opcional (1–50, por defecto 10) | `{"pages":[{"page","width","height","lines","qr"}],"timingsMs":{...}}` |

- `lines` va en orden de lectura (arriba→abajo, izquierda→derecha). Los fragmentos de una misma fila (por ejemplo `TOTAL` y `$116.00`) se unen en una línea separada por espacios. `box` son las 4 esquinas `[[x,y],…]` (sup. izq., sup. der., inf. der., inf. izq.) en las coordenadas de la imagen que se leyó: en `/v1/image`, la foto ya orientada, recortada y escalada (`width` × `height`); en `/v1/pdf`, la página renderizada.
- `confidence` está entre 0 y 1. `qr[].format` es el nombre de zxing (`QRCode`, `EAN13`, `Code128`…); `text` es el contenido crudo (para un CFDI, la URL del SAT con `re`, `rr`, `tt`, `id` y `fe`).
- El tipo se detecta por los bytes, no por el nombre ni el `Content-Type`.
- Errores, siempre JSON `{"error": "<código>", "message": "..."}`:

| HTTP | `error` | Cuándo |
|---|---|---|
| 400 | `invalid_request`, `missing_file`, `empty_file`, `invalid_max_pages` | Multipart mal formado, sin `file`, archivo vacío, `maxPages` fuera de rango |
| 401 | `unauthorized` | Token ausente o incorrecto |
| 413 | `payload_too_large`, `image_too_large` | Más de 15 MB, o más de 60 megapíxeles |
| 415 | `unsupported_media_type` | No es una imagen soportada (o no es PDF en `/v1/pdf`) |
| 422 | `invalid_image`, `invalid_pdf` | No se puede decodificar, o PDF dañado / con contraseña |
| 503 | `busy` | Esperó más de `OCR_REQUEST_TIMEOUT_SECONDS` por un turno |
| 504 | `timeout` | La lectura no terminó a tiempo |
| 500 | `internal_error` | Error inesperado (sin detalles en la respuesta) |

## Preprocesado de fotos

1. Orientación EXIF; JPEG grandes se decodifican a 1/2, 1/4 u 1/8 (lado mayor ≥ 2000 px).
2. Recorte y corrección de perspectiva del ticket **solo** si el contorno se detecta con seguridad (cuadrilátero convexo, 25–95 % de la foto, ángulos de 60–120°, papel más claro que el fondo). Si no, se usa la foto completa.
3. Lado mayor a 1600 px (las imágenes pequeñas se amplían hasta 2×).
4. Escala de grises + CLAHE (contraste local). Sin binarizar: los modelos PP-OCRv5 pierden precisión con imágenes umbralizadas.
5. QR/códigos de barras con zxing-cpp sobre la imagen decodificada y sobre la preprocesada.

Los PDFs se renderizan a `OCR_PDF_DPI` (200) sin preprocesado ni clasificador de orientación.

## Configuración

| Variable | Por defecto | Uso |
|---|---|---|
| `OCR_SERVICE_TOKEN` | — (obligatoria) | Token compartido con la API (`openssl rand -hex 32`) |
| `OCR_MAX_CONCURRENCY` | `1` | Trabajos de OCR simultáneos (acota la memoria) |
| `OCR_REQUEST_TIMEOUT_SECONDS` | `30` | Tiempo máximo de una imagen, y de espera por turno |
| `OCR_PDF_TIMEOUT_SECONDS` | `300` | Tiempo máximo de un PDF (unos 5–10 s por página) |
| `OCR_MAX_UPLOAD_MB` | `15` | Tamaño máximo del archivo |
| `OCR_PDF_DPI` | `200` | Resolución de render; `150` usa ~25 % menos memoria |
| `OCR_PDF_MAX_PAGES` | `50` | Máximo aceptado en `maxPages` |
| `OCR_THREADS` | `0` (todos los núcleos) | Hilos de ONNX Runtime. Con límite de CPU, igual al límite (ONNX Runtime no ve la cuota) |
| `OCR_USE_CLS` | `true` | Clasificador de orientación de líneas en fotos |
| `PORT` | `8090` | Puerto del contenedor |

Un solo worker de uvicorn: los modelos se cargan una vez y los trabajos pasan por un semáforo. Si una petición vence, su trabajo conserva el turno hasta terminar, para no rebasar la memoria.

## Desarrollo

```bash
# Imagen y servicio local (puerto 8090 solo en 127.0.0.1, token dev-ocr-token)
docker compose up -d --build ocr
curl -s localhost:8090/health
curl -s -H 'Authorization: Bearer dev-ocr-token' -F file=@ticket.jpg localhost:8090/v1/image

# Pruebas (imágenes sintéticas generadas en las pruebas; nunca tickets reales en el repo)
docker build --target test -t finnit-ocr:test apps/ocr && docker run --rm finnit-ocr:test

# Smoke test de la imagen (lo mismo que corre CI)
docker build -t finnit-ocr:local apps/ocr && apps/ocr/scripts/smoke-test.sh finnit-ocr:local
```

Sin Docker (Python 3.12):

```bash
cd apps/ocr
python3.12 -m venv .venv
.venv/bin/pip install setuptools==84.0.0 wheel==0.48.0
.venv/bin/pip install --no-deps --no-build-isolation -r requirements.txt -r requirements-dev.txt
.venv/bin/python scripts/download_models.py models.json .models && cp models.json .models/
OCR_MODELS_DIR=.models .venv/bin/python -m pytest
OCR_MODELS_DIR=.models OCR_SERVICE_TOKEN=dev .venv/bin/uvicorn app.main:app --port 8090
```

### Dependencias y modelos

- `requirements.txt` fija **todo** el árbol de dependencias y se instala con `--no-deps`: `rapidocr` declara `opencv-python` (con GUI) y usamos `opencv-python-headless`. Al actualizar, resuelve en un contenedor `python:3.12` arm64 y elige versiones publicadas hace al menos dos semanas.
- `models.json` fija las URLs y el sha256 de los modelos (detección `ch_PP-OCRv5_det_mobile`, orientación `ch_PP-LCNet_x0_25_textline_ori_cls_mobile`, reconocimiento `latin_PP-OCRv5_rec_mobile`, que cubre español). Se descargan al construir la imagen y la descarga falla si el hash no coincide. Los modelos no se suben al repo.

## Benchmark

`scripts/benchmark.sh` arranca la imagen con límite de memoria, envía archivos y reporta latencia, tiempos del servidor, memoria en reposo y pico, sin imprimir el texto leído. Instrucciones para el servidor en [`docs/deployment.md`](../../docs/deployment.md#ocr-servicio-interno).
