#!/usr/bin/env bash
# ONE-WAY REFERENCE SYNC: ship locally-churned match data up to Turso, WITHOUT ever overwriting
# auction state. This replaces turso-push.sh as the normal path.
#
#   local  = master for REFERENCE data   (match_performances, career_stats, players, venues, …)
#   Turso  = master for AUCTION state    (auctions, auction_pool, participants, tournaments, …)
#
# The reference half is derived: the ETL rebuilds it from cricsheet JSON that only exists on the
# laptop (~1.4GB of files, ~642k rows). The auction half is authoritative and NOT reproducible —
# it is the record of what people actually bid, typed on a phone, one row at a time.
#
# HOW IT AVOIDS THE OLD FOOTGUN
# turso-push.sh replaced the WHOLE cloud database from the local file, which meant the human had to
# remember "pull after the phone, push after the laptop". Forget it once and you either lose sales
# or get refused. Worse, its guard compared TOTAL sold rows, so it could pass while silently wiping
# one live auction. On 2026-08-18 a locally-created auction also collided with a cloud auction on
# id 40, because ids are local autoincrement on both sides.
#
# This script removes the ordering rule entirely by folding the pull INTO the push:
#   1. dump the cloud's auction tables       (cloud is master — these are carried through untouched)
#   2. snapshot the local file               (local is master for everything else)
#   3. in the snapshot, swap the local auction tables for the cloud's
#   4. verify referential integrity, verify the cloud has not changed under us, THEN upload
# So the result is always: newest reference data + real cloud auction state. Order-independent.
#
# CONSEQUENCE, BY DESIGN: auctions must be CREATED AGAINST TURSO from now on (the deployed site, or
# local dev with TURSO_DATABASE_URL set). An auction created in the local file is discarded by the
# next sync — that is the point, and it is what makes id collisions impossible.
#
# Usage: bash scripts/turso-sync.sh [db-name]
set -euo pipefail

DB_NAME="${1:-cricket-auction}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DB="$ROOT/db/cricket-auction.db"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="$ROOT/db/.turso-sync-$STAMP.db"
DUMP="$ROOT/db/.turso-sync-$STAMP.sql"

# Tables the CLOUD owns — preserved from Turso, never taken from local. The canonical list lives in
# scripts/turso_auction_state.py (AUCTION_TABLES); keep the DELETE order in step 3 in step with it.
# Derived from a writer audit: each is written by src/ (the app) and by no ETL script. `tournaments`
# belongs here because /api/pool/fetch creates it, i.e. in whichever copy the app is running against.
#
# DRY_RUN=1 does everything except the upload — builds the merged snapshot and runs every check, then
# stops. Worth doing before a real sync when an auction has been touched on the phone.
DRY_RUN="${DRY_RUN:-0}"

cleanup() { rm -f "$STAGE" "$STAGE-wal" "$STAGE-shm" "$DUMP" "$DUMP.rows" "$DUMP.log"; }
trap cleanup EXIT

command -v turso   >/dev/null || { echo "turso CLI not found. brew install tursodatabase/tap/turso"; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 not found."; exit 1; }
turso auth whoami >/dev/null 2>&1 || { echo "⛔ Not logged in. Run: turso auth login"; exit 1; }
[ -f "$LOCAL_DB" ] || { echo "⛔ Local DB not found at $LOCAL_DB"; exit 1; }

DB_EXISTS=0
if turso db list 2>/dev/null | awk '{print $1}' | grep -qx "$DB_NAME"; then DB_EXISTS=1; fi

# Cloud reads go through the libsql HTTP API (scripts/turso_auction_state.py), NOT `turso db shell`.
# turso CLI v1.0.32 rejects `.dump <table>`, so the old dump-and-grep captured zero rows silently,
# and the shell's only other output mode pads every column to the widest value, which mangles the
# multi-sentence text in auction_pool.risk_note. The HTTP API returns typed JSON, so values survive.
HELPER="$ROOT/scripts/turso_auction_state.py"
[ -f "$HELPER" ] || { echo "⛔ Missing $HELPER"; exit 1; }
if [ "$DB_EXISTS" = "1" ]; then
  export TURSO_DB_URL="$(turso db show "$DB_NAME" --url 2>/dev/null | tr -d '\r\n ')"
  export TURSO_DB_TOKEN="$(turso db tokens create "$DB_NAME" 2>/dev/null | tail -1 | tr -d '\r\n ')"
  [ -n "$TURSO_DB_URL" ] && [ -n "$TURSO_DB_TOKEN" ] || {
    echo "⛔ Could not obtain a URL/token for '$DB_NAME'"; exit 1; }
fi

# A cheap signature of cloud auction state. Re-read just before upload: if it moved, somebody is
# bidding right now and their sales would be inside our race window, so we abort instead.
cloud_fingerprint() { python3 "$HELPER" fingerprint 2>/dev/null; }

if [ "$DB_EXISTS" = "1" ]; then
  echo "──────── 1/5  read cloud auction state (cloud is master here) ────────"
  FP_BEFORE="$(cloud_fingerprint || true)"
  echo "  fingerprint: ${FP_BEFORE:-<none>}   (pool/sold/spend/auctions/purses)"

  python3 "$HELPER" dump > "$DUMP.rows" 2> "$DUMP.log" || {
    echo "⛔ Failed to read cloud auction state:"; sed 's/^/     /' "$DUMP.log"; exit 1; }
  grep -E '^-- .*[1-9][0-9]* rows$' "$DUMP.log" | sed 's/^-- /  /' || true
  ROWS=$(grep -c '^INSERT INTO' "$DUMP.rows" || true)
  echo "  $ROWS auction-state row(s) captured"

  if [ "$ROWS" -eq 0 ]; then
    echo "⛔ The cloud DB exists but returned NO auction rows. That is not a plausible state —"
    echo "   refusing to upload, because doing so would replace real auction state with nothing."
    exit 1
  fi
else
  echo "──────── 1/5  no cloud DB named '$DB_NAME' — first-time create ────────"
  ROWS=0
fi

echo "──────── 2/5  snapshot the local reference data ────────"
sqlite3 "$LOCAL_DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
sqlite3 "$LOCAL_DB" "VACUUM INTO '$STAGE';"
# `turso db create --from-file` accepts WAL only, and VACUUM INTO always writes a rollback journal.
sqlite3 "$STAGE" "PRAGMA journal_mode = WAL;" >/dev/null
# Derived cache. match_performances may have just been re-ingested, so a stale venue model is worse
# than recomputing once in the cloud; it repopulates on first use.
sqlite3 "$STAGE" "DELETE FROM bat_index_cache;" >/dev/null 2>&1 || true
echo "  snapshot: $(du -h "$STAGE" | cut -f1)"

if [ "$ROWS" -gt 0 ]; then
  echo "──────── 3/5  graft the cloud's auction state onto it ────────"
  {
    echo "PRAGMA foreign_keys=OFF;"
    echo "BEGIN;"
    # Delete in an order that does not trip FKs, i.e. children before parents.
    for T in auction_pool auction_participants watchlist tournament_teams team_captains \
             match_fantasy_scores match_results leaderboard retained_players auctions tournaments; do
      echo "DELETE FROM $T;"
    done
    echo ".read $DUMP.rows"
    echo "COMMIT;"
  } | sqlite3 "$STAGE"
  echo "  local auction rows discarded, cloud's restored"
else
  echo "──────── 3/5  nothing to graft (first-time create) ────────"
fi

echo "──────── 4/5  verify ────────"
# The FK that actually matters: every pooled player must exist. A wholesale replace of `players`
# from local is only safe while local is a superset of cloud, so prove it rather than assume it.
ORPHAN_PLAYERS=$(sqlite3 "$STAGE" "SELECT COUNT(*) FROM auction_pool ap LEFT JOIN players p ON p.id=ap.player_id WHERE p.id IS NULL;")
ORPHAN_TOURN=$(sqlite3 "$STAGE" "SELECT COUNT(*) FROM auction_pool ap LEFT JOIN tournaments t ON t.id=ap.tournament_id WHERE ap.tournament_id IS NOT NULL AND t.id IS NULL;")
ORPHAN_PART=$(sqlite3 "$STAGE" "SELECT COUNT(*) FROM auction_participants x LEFT JOIN auctions a ON a.id=x.auction_id WHERE a.id IS NULL;")
echo "  orphaned pool->players: $ORPHAN_PLAYERS | pool->tournaments: $ORPHAN_TOURN | participants->auctions: $ORPHAN_PART"
if [ "$ORPHAN_PLAYERS" != "0" ] || [ "$ORPHAN_TOURN" != "0" ] || [ "$ORPHAN_PART" != "0" ]; then
  echo "⛔ The merged snapshot has dangling references — the cloud holds auction rows pointing at"
  echo "   reference rows the laptop does not have. Uploading would show blank/wrong players on a"
  echo "   live board. Reconcile first (usually: re-run the ETL, or turso:pull and inspect)."
  exit 1
fi
sqlite3 "$STAGE" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null

if [ "$DB_EXISTS" = "1" ]; then
  FP_AFTER="$(cloud_fingerprint || true)"
  if [ "${FP_AFTER:-x}" != "${FP_BEFORE:-y}" ]; then
    echo "⛔ Cloud auction state CHANGED while this sync was preparing:"
    echo "     before: ${FP_BEFORE:-<none>}"
    echo "     now:    ${FP_AFTER:-<none>}"
    echo "   Somebody is bidding. Uploading now would lose whatever they just did."
    echo "   Wait for bidding to stop and re-run."
    exit 1
  fi
  echo "  cloud unchanged during prepare ✓"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "──────── 5/5  DRY RUN — stopping before upload ────────"
  echo "  Merged snapshot verified. It would replace Turso '$DB_NAME' with:"
  sqlite3 -header -column "$STAGE" "SELECT
      (SELECT COUNT(*) FROM match_performances) AS perf_rows,
      (SELECT COUNT(*) FROM auction_pool)       AS pool_rows,
      (SELECT COUNT(*) FROM auction_pool WHERE status='SOLD') AS sold,
      (SELECT COUNT(*) FROM auctions)           AS auctions;"
  echo "  Re-run without DRY_RUN=1 to upload."
  exit 0
fi

echo "──────── 5/5  upload ────────"
echo "  (destroy + recreate from the merged snapshot — this is the fast file path)"
if [ "$DB_EXISTS" = "1" ]; then
  turso db destroy "$DB_NAME" --yes
fi
turso db create "$DB_NAME" --from-file "$STAGE"

echo
echo "✅ Synced reference data to Turso '$DB_NAME'; auction state preserved from the cloud."
turso db show "$DB_NAME" --url
echo
echo "Reminder: create auctions AGAINST TURSO (the deployed site, or local dev with TURSO_DATABASE_URL"
echo "set). An auction created in the local file will be discarded by the next sync."
