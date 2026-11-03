#!/usr/bin/env bash
# Replaces the local database with a copy of a remote environment's
# (production or testing), after backing up the local one.
#
#   pnpm db:pull testing            # or: production
#   pnpm db:pull testing --check    # only test the connection
#   pnpm db:pull testing --yes      # no confirmation prompt
#   pnpm db:pull testing --keep-ipv6
#
# The databases live on the Hetzner server, in Dokploy containers with no
# published port. The script connects over SSH and runs pg_dump inside the
# environment's database container; the dump comes back through SSH. Set
# in packages/database/.env.remote (git-ignored; see .env.remote.example):
#   SERVER_SSH            ssh destination (user@host or a ~/.ssh/config alias)
#   <ENV>_DB_CONTAINER    optional regex of the container name (Dokploy adds
#                         a random suffix to finnit-db / finnit-db-test)
#   <ENV>_DB_NAME/_USER   optional; by default read from the container
#                         (POSTGRES_DB / POSTGRES_USER, as Dokploy set them)
#   REMOTE_DOCKER         optional, default docker (e.g. "sudo docker")
# The local database is DATABASE_URL in packages/database/.env (or
# LOCAL_DATABASE_URL); it must be on localhost.
#
# pg_restore runs inside the local Postgres container (version 18, as on
# the server), so nothing needs installing on the Mac.
#
# IPv6 is turned off on the Mac's network services while the server is
# reached and turned back on right after, also on errors or Ctrl-C. It
# needs sudo. --keep-ipv6 skips it (SSH is forced to IPv4 anyway).
#
# Files (git-ignored), in packages/database/backups/:
#   local/<db>-<timestamp>.dump     local database before it was replaced
#   <env>/<env>-<timestamp>.dump    the remote copy (deleted after a good
#                                   restore unless --keep-dump: it holds
#                                   real users' data)
# If the restore fails, the local database is restored from its backup.
#
# Restore a local backup by hand:
#   pnpm db:pull --restore backups/local/finnit_db-<timestamp>.dump

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="${PG_CONTAINER:-finnit-postgres}"
BACKUP_DIR="$DB_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

ENV_NAME=""
ASSUME_YES=false
CHECK_ONLY=false
KEEP_IPV6=false
KEEP_DUMP=false
RESTORE_FILE=""

usage() {
  sed -n '2,38p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

say() { printf '\033[1m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*" >&2; }
fail() {
  printf '\033[31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    production | testing) ENV_NAME="$1" ;;
    --yes | -y) ASSUME_YES=true ;;
    --check) CHECK_ONLY=true ;;
    --keep-ipv6) KEEP_IPV6=true ;;
    --keep-dump) KEEP_DUMP=true ;;
    --restore)
      shift
      RESTORE_FILE="${1:-}"
      [[ -n "$RESTORE_FILE" ]] || fail "--restore needs a .dump file"
      ;;
    -h | --help) usage ;;
    *) fail "Unknown argument: $1 (use production, testing or --help)" ;;
  esac
  shift
done

# --- Local database ----------------------------------------------------------

env_value() { # env_value FILE NAME → value of NAME=... (quotes removed)
  [[ -f "$1" ]] || return 0
  sed -n "s/^$2=//p" "$1" | tail -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

LOCAL_URL="${LOCAL_DATABASE_URL:-$(env_value "$DB_DIR/.env" DATABASE_URL)}"
[[ -n "$LOCAL_URL" ]] || fail "No local DATABASE_URL in $DB_DIR/.env"

# postgresql://user:password@host:port/db?params
re='^postgres(ql)?://([^:@/]+)(:([^@]*))?@([^:/?]+)(:([0-9]+))?/([^?]+)'
[[ "$LOCAL_URL" =~ $re ]] || fail "Could not read the local DATABASE_URL"
LOCAL_USER="${BASH_REMATCH[2]}"
LOCAL_HOST="${BASH_REMATCH[5]}"
LOCAL_DB="${BASH_REMATCH[8]}"
case "$LOCAL_HOST" in
  localhost | 127.0.0.1 | ::1) ;;
  *) fail "The local database must be on localhost (it is on $LOCAL_HOST)" ;;
esac
[[ "$LOCAL_DB" != "postgres" ]] || fail "Refusing to replace the 'postgres' database"

# --- Helpers -----------------------------------------------------------------

docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and try again."
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" ||
  fail "The $CONTAINER container is not running: docker-compose up -d postgres"

# psql/pg_dump/pg_restore inside the container, as the local user.
local_psql() { docker exec -i "$CONTAINER" psql -U "$LOCAL_USER" -v ON_ERROR_STOP=1 -qtA "$@"; }

backup_local() { # → path of the dump
  local file="$BACKUP_DIR/local/$LOCAL_DB-$STAMP.dump"
  mkdir -p "$BACKUP_DIR/local"
  if [[ -z "$(local_psql -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$LOCAL_DB'")" ]]; then
    warn "The local database $LOCAL_DB does not exist yet: nothing to back up"
    echo ""
    return
  fi
  docker exec "$CONTAINER" pg_dump -U "$LOCAL_USER" -d "$LOCAL_DB" -Fc >"$file"
  [[ -s "$file" ]] || fail "The local backup came out empty"
  echo "$file"
}

recreate_local() {
  # FORCE closes the API dev server's connections.
  local_psql -d postgres -c "DROP DATABASE IF EXISTS \"$LOCAL_DB\" WITH (FORCE)"
  local_psql -d postgres -c "CREATE DATABASE \"$LOCAL_DB\" OWNER \"$LOCAL_USER\""
}

restore_into_local() { # restore_into_local FILE
  docker exec -i "$CONTAINER" pg_restore -U "$LOCAL_USER" -d "$LOCAL_DB" \
    --no-owner --no-privileges --exit-on-error <"$1"
}

summary() {
  say "Local database $LOCAL_DB now has:"
  local_psql -d "$LOCAL_DB" -c "SELECT 'users: ' || count(*) FROM \"User\"" 2>/dev/null || true
  local_psql -d "$LOCAL_DB" -c "SELECT 'transactions: ' || count(*) FROM \"Transaction\"" 2>/dev/null || true
  local_psql -d "$LOCAL_DB" -c "SELECT 'latest migration: ' || migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1" 2>/dev/null || true
}

# --- Restore a local backup by hand ------------------------------------------

if [[ -n "$RESTORE_FILE" ]]; then
  [[ "$RESTORE_FILE" = /* ]] || RESTORE_FILE="$DB_DIR/$RESTORE_FILE"
  [[ -s "$RESTORE_FILE" ]] || fail "No such backup: $RESTORE_FILE"
  if ! $ASSUME_YES; then
    read -r -p "Replace the local database $LOCAL_DB with $(basename "$RESTORE_FILE")? [y/N] " answer
    [[ "$answer" =~ ^[yYsS]$ ]] || fail "Cancelled"
  fi
  say "Backing up the current local database first"
  saved="$(backup_local)"
  [[ -n "$saved" ]] && echo "  $saved"
  say "Restoring $(basename "$RESTORE_FILE")"
  recreate_local
  restore_into_local "$RESTORE_FILE"
  summary
  exit 0
fi

# --- Remote database ---------------------------------------------------------

[[ -n "$ENV_NAME" ]] || usage 1
PREFIX="$(echo "$ENV_NAME" | tr '[:lower:]' '[:upper:]')"
setting() { # setting NAME DEFAULT → environment, then .env.remote, then DEFAULT
  local value="${!1:-}"
  [[ -n "$value" ]] || value="$(env_value "$DB_DIR/.env.remote" "$1")"
  echo "${value:-$2}"
}

REMOTE_SSH="$(setting "${PREFIX}_SSH" "$(setting SERVER_SSH "")")"
[[ -n "$REMOTE_SSH" ]] ||
  fail "Set SERVER_SSH in $DB_DIR/.env.remote (see .env.remote.example)"
if [[ "$ENV_NAME" == "production" ]]; then
  CONTAINER_RE="$(setting PRODUCTION_DB_CONTAINER '^finnit-db-[a-z0-9]+([.]|$)')"
else
  CONTAINER_RE="$(setting TESTING_DB_CONTAINER '^finnit-db-test-[a-z0-9]+([.]|$)')"
fi
REMOTE_DB="$(setting "${PREFIX}_DB_NAME" "")"
REMOTE_USER="$(setting "${PREFIX}_DB_USER" "")"
REMOTE_DOCKER="$(setting REMOTE_DOCKER docker)"

# -4: IPv4 even if IPv6 stays on.
remote() { ssh -4 -o ConnectTimeout=15 "$REMOTE_SSH" "$@"; }

# The container of this environment's database (exactly one must match).
find_container() {
  local names
  names="$(remote "$REMOTE_DOCKER ps --format '{{.Names}}'" | grep -E "$CONTAINER_RE" || true)"
  [[ -n "$names" ]] ||
    fail "No running container on $REMOTE_SSH matches $CONTAINER_RE (set ${PREFIX}_DB_CONTAINER)"
  [[ "$(echo "$names" | wc -l | tr -d ' ')" == 1 ]] ||
    fail "Several containers match $CONTAINER_RE: $(echo $names). Set ${PREFIX}_DB_CONTAINER"
  [[ "$names" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "Unexpected container name: $names"
  echo "$names"
}

# --- IPv6 off while talking to the remote ------------------------------------

IPV6_TURNED_OFF=() # "service|mode" pairs to turn back on

restore_ipv6() {
  local entry service mode
  for entry in ${IPV6_TURNED_OFF[@]+"${IPV6_TURNED_OFF[@]}"}; do
    service="${entry%|*}"
    mode="${entry##*|}"
    if [[ "$mode" == "LinkLocal" ]]; then
      sudo networksetup -setv6LinkLocal "$service" || warn "Could not turn IPv6 back on for $service"
    else
      sudo networksetup -setv6automatic "$service" || warn "Could not turn IPv6 back on for $service"
    fi
  done
  if [[ ${#IPV6_TURNED_OFF[@]} -gt 0 ]]; then
    say "IPv6 turned back on"
  fi
  IPV6_TURNED_OFF=()
}

disable_ipv6() {
  if [[ "$(uname)" != "Darwin" ]]; then
    warn "Not macOS: leaving IPv6 as it is"
    return
  fi
  say "Turning IPv6 off (sudo may ask for your password)"
  local service mode
  while IFS= read -r service; do
    # Skip the header and disabled services (marked with *).
    [[ -z "$service" || "$service" == An\ asterisk* || "$service" == \** ]] && continue
    mode="$(networksetup -getinfo "$service" 2>/dev/null | sed -n 's/^IPv6: //p')"
    case "$mode" in
      Automatic | LinkLocal)
        sudo networksetup -setv6off "$service"
        IPV6_TURNED_OFF+=("$service|$mode")
        ;;
      Manual) warn "$service has a manual IPv6 setup: leaving it as it is" ;;
    esac
  done < <(networksetup -listallnetworkservices)
}

REMOTE_DUMP="$BACKUP_DIR/$ENV_NAME/$ENV_NAME-$STAMP.dump"
LOCAL_BACKUP=""
REPLACING=false # the local database was dropped
RESTORED=false

cleanup() {
  local status=$?
  restore_ipv6
  if [[ $status -ne 0 && -n "$LOCAL_BACKUP" ]] && $REPLACING && ! $RESTORED; then
    warn "Something failed: putting the local database back from $(basename "$LOCAL_BACKUP")"
    if recreate_local && restore_into_local "$LOCAL_BACKUP"; then
      warn "Local database restored as it was"
    else
      warn "Could not restore it automatically: pnpm db:pull --restore $LOCAL_BACKUP"
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

$KEEP_IPV6 || disable_ipv6

say "Looking for the $ENV_NAME database on $REMOTE_SSH"
REMOTE_CONTAINER="$(find_container)"
# Database and user as the container was created, unless given.
container_env() { remote "$REMOTE_DOCKER exec $REMOTE_CONTAINER printenv $1" 2>/dev/null | tr -d '\r' || true; }
[[ -n "$REMOTE_USER" ]] || REMOTE_USER="$(container_env POSTGRES_USER)"
REMOTE_USER="${REMOTE_USER:-postgres}"
[[ -n "$REMOTE_DB" ]] || REMOTE_DB="$(container_env POSTGRES_DB)"
REMOTE_DB="${REMOTE_DB:-$REMOTE_USER}"
for value in "$REMOTE_DB" "$REMOTE_USER"; do
  [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]] || fail "Invalid database name or user: $value"
done
REMOTE_SIZE="$(remote "$REMOTE_DOCKER exec $REMOTE_CONTAINER psql -U $REMOTE_USER -d $REMOTE_DB -tAc \"SELECT pg_size_pretty(pg_database_size('$REMOTE_DB'))\"")"
echo "  $REMOTE_CONTAINER · database $REMOTE_DB (user $REMOTE_USER) · $REMOTE_SIZE"

if $CHECK_ONLY; then
  say "Connection OK; nothing was copied"
  exit 0
fi

say "This replaces the local database $LOCAL_DB with a copy of $ENV_NAME."
echo "  The local database is backed up first, in $BACKUP_DIR/local/."
if ! $ASSUME_YES; then
  read -r -p "Type '$ENV_NAME' to continue: " answer
  [[ "$answer" == "$ENV_NAME" ]] || fail "Cancelled"
fi

# --- 1. Back up the local database -------------------------------------------

say "1/3 Backing up the local database $LOCAL_DB"
LOCAL_BACKUP="$(backup_local)"
[[ -n "$LOCAL_BACKUP" ]] && echo "  $LOCAL_BACKUP ($(du -h "$LOCAL_BACKUP" | cut -f1))"

# --- 2. Dump the remote ------------------------------------------------------

say "2/3 Copying $ENV_NAME"
mkdir -p "$(dirname "$REMOTE_DUMP")"
# Inside the container pg_dump uses the local socket: no password needed.
remote "$REMOTE_DOCKER exec $REMOTE_CONTAINER pg_dump -U $REMOTE_USER -d $REMOTE_DB -Fc --no-owner --no-privileges" >"$REMOTE_DUMP"
[[ -s "$REMOTE_DUMP" ]] || fail "The copy of $ENV_NAME came out empty"
echo "  $(du -h "$REMOTE_DUMP" | cut -f1)"

# Only the dump needed the server.
restore_ipv6

# --- 3. Replace the local database -------------------------------------------

say "3/3 Replacing the local database $LOCAL_DB"
REPLACING=true
recreate_local
restore_into_local "$REMOTE_DUMP"
RESTORED=true

if $KEEP_DUMP; then
  echo "  Copy of $ENV_NAME kept in $REMOTE_DUMP (it holds real users' data)"
else
  rm -f "$REMOTE_DUMP"
fi

summary
echo "  Previous local database: ${LOCAL_BACKUP:-none}"
echo "  If this repo has newer migrations than $ENV_NAME: pnpm db:migrate:deploy"
echo "  Restart the API dev server: its connections were closed."
