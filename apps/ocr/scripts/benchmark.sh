#!/usr/bin/env bash
# Benchmarks the OCR image on this machine (meant for the CAX11 server).
#
#   ./benchmark.sh [options] <file> [file...]
#
# Images (.jpg .jpeg .png .webp .heic) go to /v1/image, PDFs to /v1/pdf.
# Prints, per file: HTTP status, wall latency, server timings, number of
# lines/QR codes (never the OCR text), then idle and peak container memory.
#
# Options (or the matching environment variables):
#   -i IMAGE   image to run       (OCR_IMAGE, default ghcr.io/iamcharlizard/finnit-ocr:latest)
#   -l FILE    `docker load` this tar first (e.g. from `docker save finnit-ocr:local | gzip`)
#   -m MEM     memory limit       (OCR_MEMORY, default 1g; swap disabled)
#   -c CPUS    CPU limit          (OCR_CPUS, default: none)
#   -t THREADS ONNX Runtime threads (OCR_THREADS, default: CPUS rounded up, else all cores)
#   -n RUNS    runs per file      (OCR_RUNS, default 3; the first one is reported as "cold")
#   -p PORT    host port on 127.0.0.1 (OCR_PORT, default 18090)
#   -P PAGES   maxPages for PDFs  (OCR_MAX_PAGES, default 10)
#   -e VAR=VAL extra environment for the service, repeatable (e.g. -e OCR_PDF_DPI=150)
#
# Docker needs root on the server: run `sudo ./benchmark.sh ...` or set DOCKER="sudo docker".
# The container is always removed on exit.
set -euo pipefail

DOCKER=${DOCKER:-docker}
IMAGE=${OCR_IMAGE:-ghcr.io/iamcharlizard/finnit-ocr:latest}
MEMORY=${OCR_MEMORY:-1g}
CPUS=${OCR_CPUS:-}
THREADS=${OCR_THREADS:-}
RUNS=${OCR_RUNS:-3}
PORT=${OCR_PORT:-18090}
MAX_PAGES=${OCR_MAX_PAGES:-10}
LOAD=""
env_args=()

while getopts "i:l:m:c:t:n:p:P:e:h" opt; do
  case "$opt" in
    i) IMAGE=$OPTARG ;;
    l) LOAD=$OPTARG ;;
    m) MEMORY=$OPTARG ;;
    c) CPUS=$OPTARG ;;
    t) THREADS=$OPTARG ;;
    n) RUNS=$OPTARG ;;
    p) PORT=$OPTARG ;;
    P) MAX_PAGES=$OPTARG ;;
    e) env_args+=(-e "$OPTARG") ;;
    h | *) sed -n '2,25p' "$0"; exit 1 ;;
  esac
done
shift $((OPTIND - 1))
if [ "$#" -eq 0 ]; then
  sed -n '2,25p' "$0"
  exit 1
fi
for file in "$@"; do
  [ -f "$file" ] || { echo "Not a file: $file" >&2; exit 1; }
done
command -v curl > /dev/null || { echo "curl is required" >&2; exit 1; }

if [ -n "$LOAD" ]; then
  echo "Loading $LOAD ..."
  if [[ "$LOAD" == *.gz ]]; then gunzip -c "$LOAD" | $DOCKER load; else $DOCKER load -i "$LOAD"; fi
elif ! $DOCKER image inspect "$IMAGE" > /dev/null 2>&1; then
  $DOCKER pull "$IMAGE"
fi

NAME="finnit-ocr-bench-$$"
TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
WORKDIR=$(mktemp -d)
SAMPLER_PID=""
cleanup() {
  [ -n "$SAMPLER_PID" ] && kill "$SAMPLER_PID" 2> /dev/null || true
  $DOCKER rm -f "$NAME" > /dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

cpu_args=()
if [ -n "$CPUS" ]; then
  cpu_args=(--cpus "$CPUS")
  # ONNX Runtime sizes its thread pool from the visible cores, not the CFS
  # quota: without this a CPU-limited container thrashes.
  [ -z "$THREADS" ] && THREADS=$(awk -v c="$CPUS" 'BEGIN { t = int(c); if (t < c) t++; print t }')
fi
[ -n "$THREADS" ] && cpu_args+=(-e "OCR_THREADS=$THREADS")
echo "Image:  $IMAGE"
echo "Limits: memory=$MEMORY cpus=${CPUS:-unlimited} threads=${THREADS:-auto} runs/file=$RUNS"
started=$(date +%s)
$DOCKER run -d --name "$NAME" \
  --memory "$MEMORY" --memory-swap "$MEMORY" ${cpu_args[@]+"${cpu_args[@]}"} \
  -e OCR_SERVICE_TOKEN="$TOKEN" ${env_args[@]+"${env_args[@]}"} \
  -p "127.0.0.1:$PORT:8090" \
  "$IMAGE" > /dev/null

until curl -fsS "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; do
  if [ "$($DOCKER inspect -f '{{.State.Running}}' "$NAME")" != "true" ]; then
    echo "Container exited:" >&2
    $DOCKER logs "$NAME" >&2 || true
    exit 1
  fi
  sleep 0.5
done
echo "Ready in ~$(($(date +%s) - started)) s (container start + model load)"

# Memory from the container's cgroup (v2): current and peak, in bytes.
mem_file() { $DOCKER exec "$NAME" cat "/sys/fs/cgroup/$1" 2> /dev/null || echo ""; }
mib() { [ -n "$1" ] && echo "$(($1 / 1024 / 1024)) MiB" || echo "n/a"; }

sleep 2
idle=$(mem_file memory.current)
startup_peak=$(mem_file memory.peak)
echo "Idle memory (models loaded): $(mib "$idle"); peak during startup: $(mib "$startup_peak")"

# Fallback sampler for kernels without memory.peak: `docker stats` every ~1 s.
$DOCKER stats --format '{{.MemUsage}}' "$NAME" > "$WORKDIR/stats.log" 2> /dev/null &
SAMPLER_PID=$!

printf '\n%-28s %4s %6s %8s  %s\n' "file" "run" "http" "wall(s)" "server timings (ms) / lines / qr"
for file in "$@"; do
  case "$(echo "$file" | tr '[:upper:]' '[:lower:]')" in
    *.pdf) endpoint=pdf; extra=(-F "maxPages=$MAX_PAGES") ;;
    *) endpoint=image; extra=() ;;
  esac
  for run in $(seq 1 "$RUNS"); do
    out="$WORKDIR/response.json"
    result=$(curl -sS -o "$out" -w '%{http_code} %{time_total}' \
      -H "Authorization: Bearer $TOKEN" -F "file=@$file" ${extra[@]+"${extra[@]}"} \
      "http://127.0.0.1:$PORT/v1/$endpoint" || echo "000 0")
    code=${result%% *}
    wall=${result##* }
    timings=$(grep -o '"timingsMs":{[^}]*}' "$out" 2> /dev/null | sed 's/"timingsMs"://; s/[{}"]//g' || true)
    lines=$({ grep -o '"confidence"' "$out" 2> /dev/null || true; } | wc -l | tr -d ' ')
    qrs=$({ grep -o '"format"' "$out" 2> /dev/null || true; } | wc -l | tr -d ' ')
    label=$(basename "$file")
    [ "$run" -eq 1 ] && tag="cold" || tag="$run"
    if [ "$code" = "200" ]; then
      printf '%-28s %4s %6s %8.2f  %s / %s lines / %s qr\n' "${label:0:28}" "$tag" "$code" "$wall" "$timings" "$lines" "$qrs"
    else
      printf '%-28s %4s %6s %8.2f  %s\n' "${label:0:28}" "$tag" "$code" "$wall" "$(head -c 200 "$out" 2> /dev/null)"
    fi
  done
done

sleep 1
after=$(mem_file memory.current)
peak=$(mem_file memory.peak)
kill "$SAMPLER_PID" 2> /dev/null || true
SAMPLER_PID=""
echo
echo "Memory after the run: $(mib "$after")"
if [ -n "$peak" ]; then
  echo "Peak memory (cgroup memory.peak, includes page cache): $(mib "$peak")"
fi
if [ -s "$WORKDIR/stats.log" ]; then
  sampled=$(tr -d '\033' < "$WORKDIR/stats.log" | sed 's/\[[0-9;]*[A-Za-z]//g' | grep -o '^[0-9.]*[KMG]i*B' | sort -h | tail -1 || true)
  [ -n "$sampled" ] && echo "Peak memory (docker stats sampling, without page cache): $sampled"
fi
echo "OOM killed: $($DOCKER inspect -f '{{.State.OOMKilled}}' "$NAME")"
