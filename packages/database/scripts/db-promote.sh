#!/usr/bin/env bash
# Replaces the production database with a copy of testing's.
#
#   pnpm db:promote --check                 # only compare both; copies nothing
#   pnpm db:promote                         # copy testing → production
#   pnpm db:promote --allow-newer-schema    # testing has migrations production's code lacks
#   pnpm db:promote --list                  # earlier production databases kept on the server
#   pnpm db:promote --rollback <database>   # put one of them back as production
#   pnpm db:promote --keep-ipv6
#
# Production is never overwritten in place:
#   1. production is backed up to the Mac (packages/database/backups/production/)
#   2. testing is restored into a new database next to production's, in the
#      production container (<db>_incoming_<timestamp>); production keeps
#      running meanwhile, and a failed restore leaves it untouched
#   3. the new database is checked (migrations, users) and swapped in by
#      renaming: production becomes <db>_before_<timestamp> (kept on the
#      server) and the new one takes its name. Connections to production are
#      closed for the swap, a moment.
# Going back is another rename: --rollback <db>_before_<timestamp>.
# Old copies stay until dropped by hand (they hold real users' data):
#   DROP DATABASE "<db>_before_<timestamp>";  (in the production container)
#
# Settings: the same packages/database/.env.remote as db:pull
# (SERVER_SSH or TESTING_SSH / PRODUCTION_SSH, <ENV>_DB_CONTAINER,
# <ENV>_DB_NAME / _USER, REMOTE_DOCKER). When both environments are on the
# same SSH destination the copy goes from container to container on the
# server; otherwise it streams through this Mac.
#
# Migrations: production's API runs `prisma migrate deploy` on start. If
# testing has migrations production's code doesn't know, the API would run
# on a newer schema than its code: the script stops unless
# --allow-newer-schema (deploy main with those migrations first, ideally).
# Migrations only production has are applied when its API restarts.
#
# After the copy, restart the production API in Dokploy.

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DB_DIR/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"

CHECK_ONLY=false
LIST_ONLY=false
KEEP_IPV6=false
ALLOW_NEWER=false
ROLLBACK_DB=""

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
    --check) CHECK_ONLY=true ;;
    --list) LIST_ONLY=true ;;
    --keep-ipv6) KEEP_IPV6=true ;;
    --allow-newer-schema) ALLOW_NEWER=true ;;
    --rollback)
      shift
      ROLLBACK_DB="${1:-}"
      [[ -n "$ROLLBACK_DB" ]] || fail "--rollback needs a database name (see --list)"
      ;;
    -h | --help) usage ;;
    *) fail "Unknown argument: $1 (see --help)" ;;
  esac
  shift
done

# --- Settings ----------------------------------------------------------------

env_value() { # env_value FILE NAME → value of NAME=... (quotes removed)
  [[ -f "$1" ]] || return 0
  sed -n "s/^$2=//p" "$1" | tail -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

setting() { # setting NAME DEFAULT → environment, then .env.remote, then DEFAULT
  local value="${!1:-}"
  [[ -n "$value" ]] || value="$(env_value "$DB_DIR/.env.remote" "$1")"
  echo "${value:-$2}"
}

SERVER_SSH="$(setting SERVER_SSH "")"
T_SSH="$(setting TESTING_SSH "$SERVER_SSH")"
P_SSH="$(setting PRODUCTION_SSH "$SERVER_SSH")"
[[ -n "$T_SSH" && -n "$P_SSH" ]] ||
  fail "Set SERVER_SSH in $DB_DIR/.env.remote (see .env.remote.example)"
T_RE="$(setting TESTING_DB_CONTAINER '^finnit-db-test-[a-z0-9]+([.]|$)')"
P_RE="$(setting PRODUCTION_DB_CONTAINER '^finnit-db-[a-z0-9]+([.]|$)')"
REMOTE_DOCKER="$(setting REMOTE_DOCKER docker)"

# -4: IPv4 even if IPv6 stays on.
ssh_to() { # ssh_to DEST COMMAND...
  local dest="$1"
  shift
  ssh -4 -o ConnectTimeout=15 "$dest" "$@"
}
on_testing() { ssh_to "$T_SSH" "$@"; }
on_production() { ssh_to "$P_SSH" "$@"; }

safe_name() { [[ "$1" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "Unexpected name: $1"; }

find_container() { # find_container ENV REGEX → the one running container
  local env="$1" re="$2" names
  if [[ "$env" == testing ]]; then
    names="$(on_testing "$REMOTE_DOCKER ps --format '{{.Names}}'" | grep -E "$re" || true)"
  else
    names="$(on_production "$REMOTE_DOCKER ps --format '{{.Names}}'" | grep -E "$re" || true)"
  fi
  [[ -n "$names" ]] || fail "No running $env database container matches $re"
  [[ "$(echo "$names" | wc -l | tr -d ' ')" == 1 ]] ||
    fail "Several $env containers match $re: $(echo $names)"
  safe_name "$names"
  echo "$names"
}

# --- IPv6 off while talking to the server (as db:pull does) ------------------

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

# --- State for cleanup ---------------------------------------------------------

INCOMING_DB="" # created in production's container, not swapped in yet
SWAPPING=false
SWAP_OLD=""    # what production was renamed to during a swap
SWAP_NEW=""    # what took production's name

cleanup() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    if $SWAPPING; then
      warn "The swap failed: checking production's database"
      recover_swap || warn "Check the databases by hand: pnpm db:promote --list"
    elif [[ -n "$INCOMING_DB" ]]; then
      warn "Dropping the unfinished copy $INCOMING_DB (production was not touched)"
      p_sql postgres <<<"DROP DATABASE IF EXISTS \"$INCOMING_DB\" WITH (FORCE);" ||
        warn "Could not drop $INCOMING_DB: drop it by hand"
    fi
  fi
  restore_ipv6
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

$KEEP_IPV6 || disable_ipv6

# --- Both databases ------------------------------------------------------------

say "Looking for the databases"
T_CONTAINER="$(find_container testing "$T_RE")"
P_CONTAINER="$(find_container production "$P_RE")"
if [[ "$T_SSH" == "$P_SSH" && "$T_CONTAINER" == "$P_CONTAINER" ]]; then
  fail "Testing and production resolve to the same container ($T_CONTAINER)"
fi

t_env() { on_testing "$REMOTE_DOCKER exec $T_CONTAINER printenv $1" 2>/dev/null | tr -d '\r' || true; }
p_env() { on_production "$REMOTE_DOCKER exec $P_CONTAINER printenv $1" 2>/dev/null | tr -d '\r' || true; }

T_USER="$(setting TESTING_DB_USER "")"
[[ -n "$T_USER" ]] || T_USER="$(t_env POSTGRES_USER)"
T_USER="${T_USER:-postgres}"
T_DB="$(setting TESTING_DB_NAME "")"
[[ -n "$T_DB" ]] || T_DB="$(t_env POSTGRES_DB)"
T_DB="${T_DB:-$T_USER}"
P_USER="$(setting PRODUCTION_DB_USER "")"
[[ -n "$P_USER" ]] || P_USER="$(p_env POSTGRES_USER)"
P_USER="${P_USER:-postgres}"
P_DB="$(setting PRODUCTION_DB_NAME "")"
[[ -n "$P_DB" ]] || P_DB="$(p_env POSTGRES_DB)"
P_DB="${P_DB:-$P_USER}"
for value in "$T_USER" "$T_DB" "$P_USER" "$P_DB"; do
  [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]] || fail "Invalid database name or user: $value"
done
[[ "$P_DB" != postgres ]] || fail "Refusing to replace the 'postgres' database"

# SQL from stdin, unaligned output without headers.
t_sql() { on_testing "$REMOTE_DOCKER exec -i $T_CONTAINER psql -U $T_USER -d $1 -v ON_ERROR_STOP=1 -qtA"; }
p_sql() { on_production "$REMOTE_DOCKER exec -i $P_CONTAINER psql -U $P_USER -d $1 -v ON_ERROR_STOP=1 -qtA"; }

SUMMARY_SQL="
SELECT 'size: ' || pg_size_pretty(pg_database_size(current_database()));
SELECT 'users: ' || count(*) FROM \"User\";
SELECT 'transactions: ' || count(*) FROM \"Transaction\";
SELECT 'latest migration: ' || coalesce(max(migration_name), '-') FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
MIGRATIONS_SQL="SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1;"
PENDING_SQL="SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"

# --- Swapping by rename ----------------------------------------------------------

db_exists() { # db_exists NAME → "1" or ""
  p_sql postgres <<<"SELECT 1 FROM pg_database WHERE datname = '$1';"
}

# swap NEW OLD: production's database becomes OLD and NEW takes its name.
swap() {
  local new="$1" old="$2"
  SWAP_NEW="$new"
  SWAP_OLD="$old"
  SWAPPING=true
  # Nobody (the API included) can connect while the names change.
  p_sql postgres >/dev/null <<SQL
ALTER DATABASE "$P_DB" WITH ALLOW_CONNECTIONS false;
SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE datname = '$P_DB' AND pid <> pg_backend_pid();
ALTER DATABASE "$P_DB" RENAME TO "$old";
ALTER DATABASE "$new" RENAME TO "$P_DB";
ALTER DATABASE "$P_DB" WITH ALLOW_CONNECTIONS true;
ALTER DATABASE "$old" WITH ALLOW_CONNECTIONS true;
SQL
  SWAPPING=false
}

# After a failed swap: make sure a database answers to production's name.
recover_swap() {
  if [[ -n "$(db_exists "$P_DB")" ]]; then
    p_sql postgres <<<"ALTER DATABASE \"$P_DB\" WITH ALLOW_CONNECTIONS true;"
    warn "Production's database is in place"
  elif [[ -n "$(db_exists "$SWAP_OLD")" ]]; then
    p_sql postgres <<SQL
ALTER DATABASE "$SWAP_OLD" RENAME TO "$P_DB";
ALTER DATABASE "$P_DB" WITH ALLOW_CONNECTIONS true;
SQL
    warn "Production's previous database is back under its name"
  else
    return 1
  fi
}

# --- --list ----------------------------------------------------------------------

list_kept() {
  p_sql postgres <<SQL
SELECT datname || '  ' || pg_size_pretty(pg_database_size(datname))
FROM pg_database
WHERE datname LIKE '${P_DB}\_before\_%' OR datname LIKE '${P_DB}\_rolledback\_%' OR datname LIKE '${P_DB}\_incoming\_%'
ORDER BY datname;
SQL
}

if $LIST_ONLY; then
  say "Databases kept next to production ($P_CONTAINER)"
  kept="$(list_kept)"
  echo "${kept:-  none}"
  exit 0
fi

# --- --rollback ------------------------------------------------------------------

if [[ -n "$ROLLBACK_DB" ]]; then
  safe_name "$ROLLBACK_DB"
  [[ "$ROLLBACK_DB" == "$P_DB"_* ]] || fail "$ROLLBACK_DB is not one of production's kept databases (see --list)"
  [[ -n "$(db_exists "$ROLLBACK_DB")" ]] || fail "No database $ROLLBACK_DB in $P_CONTAINER (see --list)"
  say "Production now"
  p_sql "$P_DB" <<<"$SUMMARY_SQL" | sed 's/^/  /'
  say "$ROLLBACK_DB"
  p_sql "$ROLLBACK_DB" <<<"$SUMMARY_SQL" | sed 's/^/  /'
  echo "  Production's current database is kept as ${P_DB}_rolledback_$STAMP."
  read -r -p "Type 'rollback' to put $ROLLBACK_DB back as production: " answer
  [[ "$answer" == "rollback" ]] || fail "Cancelled"
  swap "$ROLLBACK_DB" "${P_DB}_rolledback_$STAMP"
  say "Done: $ROLLBACK_DB is production again. Restart the production API in Dokploy."
  exit 0
fi

# --- Compare -----------------------------------------------------------------------

say "Testing ($T_CONTAINER · $T_DB)"
t_sql "$T_DB" <<<"$SUMMARY_SQL" | sed 's/^/  /'
say "Production ($P_CONTAINER · $P_DB)"
p_sql "$P_DB" <<<"$SUMMARY_SQL" | sed 's/^/  /'

[[ "$(t_sql "$T_DB" <<<"$PENDING_SQL")" == 0 ]] ||
  fail "Testing has a migration that didn't finish: fix testing first"

T_MIGRATIONS="$(t_sql "$T_DB" <<<"$MIGRATIONS_SQL")"
P_MIGRATIONS="$(p_sql "$P_DB" <<<"$MIGRATIONS_SQL")"
# comm needs both lists in its own sort order.
ONLY_TESTING="$(comm -23 <(echo "$T_MIGRATIONS" | LC_ALL=C sort) <(echo "$P_MIGRATIONS" | LC_ALL=C sort) | sed '/^$/d')"
ONLY_PRODUCTION="$(comm -13 <(echo "$T_MIGRATIONS" | LC_ALL=C sort) <(echo "$P_MIGRATIONS" | LC_ALL=C sort) | sed '/^$/d')"
if [[ -n "$ONLY_PRODUCTION" ]]; then
  warn "Only production has these migrations; its API applies them again when it restarts:"
  echo "$ONLY_PRODUCTION" | sed 's/^/    /' >&2
fi
if [[ -n "$ONLY_TESTING" ]]; then
  warn "Only testing has these migrations (production's code may not know them):"
  echo "$ONLY_TESTING" | sed 's/^/    /' >&2
  if ! $ALLOW_NEWER && ! $CHECK_ONLY; then
    fail "Deploy main with them first, or pass --allow-newer-schema"
  fi
fi

if $CHECK_ONLY; then
  say "Check done; nothing was copied"
  exit 0
fi

# --- Confirm -----------------------------------------------------------------------

cat <<EOF

$(say "This REPLACES PRODUCTION's database with a copy of testing's.")
  Everything in production today is replaced: users, passwords, movements,
  bank connections. Production's users get testing's.
  Files (statements, receipts, avatars) live in each environment's S3
  bucket: testing's rows will point at keys production's bucket may not have.
  Sessions signed with another JWT secret stop working: users sign in again.
  Production is backed up to this Mac first, and its database stays on the
  server as ${P_DB}_before_$STAMP (pnpm db:promote --rollback).

EOF
read -r -p "Type 'production' to continue: " answer
[[ "$answer" == "production" ]] || fail "Cancelled"

# --- 1. Back up production ---------------------------------------------------------

say "1/4 Backing up production to this Mac"
P_BACKUP="$BACKUP_DIR/production/production-before-promote-$STAMP.dump"
mkdir -p "$(dirname "$P_BACKUP")"
on_production "$REMOTE_DOCKER exec $P_CONTAINER pg_dump -U $P_USER -d $P_DB -Fc --no-owner --no-privileges" >"$P_BACKUP"
[[ -s "$P_BACKUP" ]] || fail "Production's backup came out empty"
echo "  $P_BACKUP ($(du -h "$P_BACKUP" | cut -f1); real users' data, git-ignored)"

# --- 2. Copy testing next to production --------------------------------------------

INCOMING="${P_DB}_incoming_$STAMP"
say "2/4 Copying testing into $INCOMING (production keeps running)"
p_sql postgres <<<"CREATE DATABASE \"$INCOMING\" OWNER \"$P_USER\";"
INCOMING_DB="$INCOMING"
DUMP="$REMOTE_DOCKER exec $T_CONTAINER pg_dump -U $T_USER -d $T_DB -Fc --no-owner --no-privileges"
RESTORE="$REMOTE_DOCKER exec -i $P_CONTAINER pg_restore -U $P_USER -d $INCOMING --no-owner --no-privileges --exit-on-error"
if [[ "$T_SSH" == "$P_SSH" ]]; then
  # Same server: container to container, nothing goes through this Mac.
  on_production bash -s <<EOF
set -euo pipefail
$DUMP | $RESTORE
EOF
else
  on_testing "$DUMP" | on_production "$RESTORE"
fi

# --- 3. Check the copy ---------------------------------------------------------------

say "3/4 Checking the copy"
p_sql "$INCOMING" <<<"$SUMMARY_SQL" | sed 's/^/  /'
[[ "$(p_sql "$INCOMING" <<<"$MIGRATIONS_SQL")" == "$T_MIGRATIONS" ]] ||
  fail "The copy's migrations don't match testing's"
[[ "$(p_sql "$INCOMING" <<<'SELECT count(*) FROM "User";')" == "$(t_sql "$T_DB" <<<'SELECT count(*) FROM "User";')" ]] ||
  fail "The copy's users don't match testing's"

# --- 4. Swap -------------------------------------------------------------------------

say "4/4 Swapping it in (production's connections close for a moment)"
swap "$INCOMING" "${P_DB}_before_$STAMP"
INCOMING_DB=""

say "Production now has:"
p_sql "$P_DB" <<<"$SUMMARY_SQL" | sed 's/^/  /'
cat <<EOF
  Previous production: ${P_DB}_before_$STAMP on the server, and $P_BACKUP
  Go back with: pnpm db:promote --rollback ${P_DB}_before_$STAMP
  Restart the production API in Dokploy (its connections were closed).
EOF
