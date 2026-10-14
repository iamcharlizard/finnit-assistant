#!/usr/bin/env bash
# Smoke test for an OCR image: boots it, checks /health and auth, then OCRs a
# synthetic receipt (text + CFDI-style QR) generated inside the image itself.
#
#   apps/ocr/scripts/smoke-test.sh <image>      e.g. finnit-ocr:ci
#
# Needs docker and curl. The container is removed on exit.
set -euo pipefail

IMAGE=${1:?usage: smoke-test.sh <image>}
PORT=${SMOKE_PORT:-18091}
NAME="finnit-ocr-smoke-$$"
TOKEN="smoke-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
WORKDIR=$(mktemp -d)
QR_TEXT='https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=5803EB8D-81CD-4557-8719-26632D2FA434&re=XAXX010101000&rr=XEXX010101000&tt=000000000116.000000&fe=Q7FZ1ofA'

cleanup() {
  docker rm -f "$NAME" > /dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  echo "--- container logs ---" >&2
  docker logs "$NAME" >&2 || true
  exit 1
}

echo "1. Refuses to start without OCR_SERVICE_TOKEN"
if docker run --rm "$IMAGE" > "$WORKDIR/no-token.log" 2>&1; then
  echo "FAIL: container started without a token" >&2
  exit 1
fi
grep -q "OCR_SERVICE_TOKEN" "$WORKDIR/no-token.log" || { cat "$WORKDIR/no-token.log" >&2; echo "FAIL: unexpected error" >&2; exit 1; }

echo "2. Starts and reports healthy"
docker run -d --name "$NAME" -e OCR_SERVICE_TOKEN="$TOKEN" -p "127.0.0.1:$PORT:8090" "$IMAGE" > /dev/null
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$PORT/health" -o "$WORKDIR/health.json" 2> /dev/null; then break; fi
  [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" = "true" ] || fail "container exited"
  sleep 0.5
done
grep -q '"status":"ok"' "$WORKDIR/health.json" || fail "health: $(cat "$WORKDIR/health.json" 2> /dev/null)"
grep -q '"models":"PP-OCRv5"' "$WORKDIR/health.json" || fail "health: $(cat "$WORKDIR/health.json")"

echo "3. Generates a synthetic receipt inside the image"
docker run --rm --entrypoint python -e QR_TEXT="$QR_TEXT" "$IMAGE" -c '
import io, os, sys
import zxingcpp
from PIL import Image, ImageDraw, ImageFont
rows = [("TIENDA DEMO", None), ("FECHA 12/10/2026", None), ("SUBTOTAL", "100.00"), ("IVA", "16.00"), ("TOTAL", "116.00")]
img = Image.new("RGB", (900, 900), "white")
draw = ImageDraw.Draw(img)
font = ImageFont.load_default(size=40)
for i, (label, amount) in enumerate(rows):
    draw.text((50, 60 + i * 64), label, fill="black", font=font)
    if amount:
        draw.text((640, 60 + i * 64), "$" + amount, fill="black", font=font)
qr = Image.fromarray(zxingcpp.create_barcode(os.environ["QR_TEXT"], zxingcpp.BarcodeFormat.QRCode).to_image(scale=4))
img.paste(qr.convert("RGB"), ((900 - qr.width) // 2, 420))
buffer = io.BytesIO()
img.save(buffer, format="JPEG", quality=90)
sys.stdout.buffer.write(buffer.getvalue())
' > "$WORKDIR/receipt.jpg"
[ -s "$WORKDIR/receipt.jpg" ] || fail "could not generate the sample image"

echo "4. Rejects requests without a valid token"
code=$(curl -sS -o /dev/null -w '%{http_code}' -F "file=@$WORKDIR/receipt.jpg" "http://127.0.0.1:$PORT/v1/image")
[ "$code" = "401" ] || fail "expected 401 without token, got $code"
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer wrong" -F "file=@$WORKDIR/receipt.jpg" "http://127.0.0.1:$PORT/v1/image")
[ "$code" = "401" ] || fail "expected 401 with a wrong token, got $code"

echo "5. OCRs the receipt"
code=$(curl -sS -o "$WORKDIR/ocr.json" -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  -F "file=@$WORKDIR/receipt.jpg;type=image/jpeg" "http://127.0.0.1:$PORT/v1/image")
[ "$code" = "200" ] || fail "expected 200, got $code: $(head -c 300 "$WORKDIR/ocr.json")"
grep -Eq '"text":"TOTAL \$?116[.,]00"' "$WORKDIR/ocr.json" || fail "TOTAL line not found: $(head -c 1000 "$WORKDIR/ocr.json")"
grep -q '"format":"QRCode"' "$WORKDIR/ocr.json" || fail "QR not decoded"
grep -q 'tt=000000000116.000000' "$WORKDIR/ocr.json" || fail "QR text mismatch"
grep -o '"timingsMs":{[^}]*}' "$WORKDIR/ocr.json"

echo "6. Rejects unsupported files"
printf 'not an image' > "$WORKDIR/x.txt"
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -F "file=@$WORKDIR/x.txt" "http://127.0.0.1:$PORT/v1/image")
[ "$code" = "415" ] || fail "expected 415, got $code"

echo "Smoke test passed."
