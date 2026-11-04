#!/usr/bin/env bash
# Runs the API (port 3000) and the web app (port 3001) together, in
# development, with what they need locally:
#
#   pnpm dev:local                 # everything
#   pnpm dev:local --no-docker     # don't touch Docker (services already up)
#   pnpm dev:local --no-migrate    # don't apply pending migrations
#   pnpm dev:local --no-ocr        # leave the OCR container off
#
# 1. NODE_ENV=development for both (the API also reads apps/api/.env; the
#    web uses apps/web/.env.local and talks to http://localhost:3000).
# 2. Docker running (opens Docker Desktop on macOS) and the docker-compose
#    services the API uses: postgres always; s3 (files) and ocr (receipts)
#    only when apps/api/.env points S3_ENDPOINT / OCR_SERVICE_URL at
#    localhost (without S3_ENDPOINT the API uses real AWS S3).
# 3. Pending migrations applied to the local database (prisma migrate
#    deploy: only migrations already in the repo, nothing is reset).
# 4. Ports 3000 and 3001 free, then both dev servers through Turborepo
#    (the API builds @finnit/database first). Ctrl-C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

USE_DOCKER=true
MIGRATE=true
WITH_OCR=true

for arg in "$@"; do
  case "$arg" in
    --no-docker) USE_DOCKER=false ;;
    --no-migrate) MIGRATE=false ;;
    --no-ocr) WITH_OCR=false ;;
    -h | --help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (see --help)" >&2
      exit 1
      ;;
  esac
done

say() { printf '\033[1m▸ %s\033[0m\n' "$*"; }
fail() {
  printf '\033[31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

export NODE_ENV=development

# Value of NAME in apps/api/.env (quotes removed).
api_env() { sed -n "s/^$1=//p" apps/api/.env 2>/dev/null | tail -1 | tr -d "\"'"; }
is_local() { [[ "$1" =~ ^https?://(localhost|127\.0\.0\.1)(:|/|$) ]]; }

SERVICES=(postgres)
is_local "$(api_env S3_ENDPOINT)" && SERVICES+=(s3)
$WITH_OCR && is_local "$(api_env OCR_SERVICE_URL)" && SERVICES+=(ocr)

# --- Docker services -----------------------------------------------------------

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

if $USE_DOCKER; then
  if ! docker info >/dev/null 2>&1; then
    [[ "$(uname)" == "Darwin" ]] || fail "Docker is not running"
    say "Starting Docker Desktop"
    open -a Docker
    for _ in $(seq 1 60); do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
    docker info >/dev/null 2>&1 || fail "Docker did not start in 2 minutes"
  fi

  say "Starting ${SERVICES[*]}"
  compose up -d "${SERVICES[@]}"

  for _ in $(seq 1 30); do
    docker exec finnit-postgres pg_isready -q >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec finnit-postgres pg_isready -q >/dev/null 2>&1 ||
    fail "Postgres (finnit-postgres) is not accepting connections"
fi

# --- Migrations ----------------------------------------------------------------

if $MIGRATE; then
  say "Applying pending migrations"
  pnpm --filter @finnit/database exec prisma migrate deploy
fi

# --- Ports -----------------------------------------------------------------------

for port in 3000 3001; do
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  if [[ -n "$pid" ]]; then
    fail "Port $port is in use by $(ps -p "$pid" -o comm= 2>/dev/null || echo "?") (pid $pid). Stop it first (e.g. kill $pid)."
  fi
done

# --- API + web -------------------------------------------------------------------

say "API on http://localhost:3000/graphql · web on http://localhost:3001"
exec pnpm turbo run start:dev dev --filter=@finnit/api --filter=@finnit/web
