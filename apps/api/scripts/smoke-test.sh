#!/usr/bin/env bash
# Boots an API image against a throwaway Postgres and checks that migrations
# apply, the health check passes and the auth flow works end to end.
#   Usage: apps/api/scripts/smoke-test.sh <image>
set -euo pipefail

IMAGE="${1:?usage: smoke-test.sh <image>}"
NET="finnit-smoke-$$"
DB="smoke-db-$$"
API="smoke-api-$$"
PORT="${SMOKE_PORT:-3999}"

cleanup() {
  docker logs "$API" > smoke-api.log 2>&1 || true
  docker rm -f "$API" "$DB" > /dev/null 2>&1 || true
  docker network rm "$NET" > /dev/null 2>&1 || true
}
trap cleanup EXIT

gql() {
  local auth=()
  if [ -n "${2:-}" ]; then auth=(-H "authorization: Bearer $2"); fi
  curl -fsS -X POST "http://127.0.0.1:$PORT/graphql" \
    -H 'content-type: application/json' ${auth[@]+"${auth[@]}"} -d "$1"
}

docker network create "$NET" > /dev/null
docker run -d --name "$DB" --network "$NET" \
  -e POSTGRES_USER=finnit -e POSTGRES_PASSWORD=smoke -e POSTGRES_DB=finnit \
  postgres:18-alpine > /dev/null
until docker exec "$DB" pg_isready -U finnit -d finnit > /dev/null 2>&1; do sleep 1; done

docker run -d --name "$API" --network "$NET" -p "$PORT:3000" \
  -e DATABASE_URL="postgresql://finnit:smoke@$DB:5432/finnit" \
  -e JWT_SECRET=smoke-test-secret \
  "$IMAGE" > /dev/null

echo "Waiting for /health..."
for _ in $(seq 1 90); do
  if curl -fs "http://127.0.0.1:$PORT/health" > /dev/null; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/health"
echo

# There is no public sign-up: create the user with the create-master command
# (run after /health, so the entrypoint already applied the migrations).
PASSWORD='Sm0ke-Test-123!'
echo "create-master / signIn / me..."
docker exec -e MASTER_PASSWORD="$PASSWORD" "$API" \
  node apps/api/dist/scripts/create-master.js --email smoke@test.dev --name Smoke
TOKEN=$(gql "{\"query\":\"mutation { signIn(input:{email:\\\"smoke@test.dev\\\", password:\\\"$PASSWORD\\\"}) { accessToken } }\"}" \
  | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
ME=$(gql '{"query":"{ me { email role } }"}' "$TOKEN")
echo "$ME" | grep -q '"email":"smoke@test.dev"'
echo "$ME" | grep -q '"role":"admin"'

echo "Smoke test passed."
