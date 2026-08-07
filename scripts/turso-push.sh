#!/usr/bin/env bash
# Push the LOCAL SQLite database up to Turso (cloud), replacing what's there.
#
# WHEN TO RUN: before an auction, and after any ETL / valuation / squad work on the laptop.
# The cloud copy is a REPLACEMENT, so anything written in the cloud since the last push is LOST —
# run scripts/turso-pull.sh FIRST if a cloud auction has sales you haven't brought back down.
#
# Usage: scripts/turso-push.sh [db-name]
set -euo pipefail

DB_NAME="${1:-cricket-auction}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DB="$ROOT/db/cricket-auction.db"
STAGE="$ROOT/db/.turso-push.db"

command -v turso >/dev/null || { echo "turso CLI not found. brew install tursodatabase/tap/turso"; exit 1; }
turso auth whoami >/dev/null 2>&1 || { echo "Not logged in. Run: turso auth login"; exit 1; }
[ -f "$LOCAL_DB" ] || { echo "Local DB not found at $LOCAL_DB"; exit 1; }

# Refuse to clobber a cloud auction that has sales the local copy doesn't know about.
if turso db list 2>/dev/null | awk '{print $1}' | grep -qx "$DB_NAME"; then
  CLOUD_SOLD=$(turso db shell "$DB_NAME" \
    "SELECT COALESCE(SUM(status='SOLD'),0) FROM auction_pool;" 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)
  LOCAL_SOLD=$(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM auction_pool WHERE status='SOLD';")
  echo "SOLD rows — cloud: ${CLOUD_SOLD:-0}, local: ${LOCAL_SOLD}"
  if [ "${CLOUD_SOLD:-0}" -gt "${LOCAL_SOLD}" ]; then
    echo
    echo "⛔ The cloud has MORE sold rows than local (${CLOUD_SOLD} > ${LOCAL_SOLD})."
    echo "   Pushing would wipe sales made on your phone and leave purses debited with no matching"
    echo "   sale — the exact corruption CLAUDE.md warns about."
    echo "   Run scripts/turso-pull.sh first, then push."
    exit 1
  fi
fi

# WAL pages aren't in the main file until checkpointed; VACUUM INTO also gives a compact snapshot.
echo "Snapshotting local DB (checkpoint + vacuum)…"
rm -f "$STAGE" "$STAGE-wal" "$STAGE-shm"
sqlite3 "$LOCAL_DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
sqlite3 "$LOCAL_DB" "VACUUM INTO '$STAGE';"
# VACUUM INTO always writes a rollback-journal database; `turso db create --from-file`
# only accepts WAL. Flip it, then checkpoint so everything is back in the main file.
# Drop the derived Bat Index cache: match_performances may have just been re-ingested, and serving a
# stale venue model would be worse than recomputing it once in the cloud (it repopulates on first use).
sqlite3 "$STAGE" "DROP TABLE IF EXISTS bat_index_cache;" >/dev/null
sqlite3 "$STAGE" "PRAGMA journal_mode = WAL;" >/dev/null
sqlite3 "$STAGE" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
echo "  snapshot: $(du -h "$STAGE" | cut -f1)  ($(sqlite3 "$STAGE" 'PRAGMA journal_mode;'))"

if turso db list 2>/dev/null | awk '{print $1}' | grep -qx "$DB_NAME"; then
  echo "Destroying + recreating '$DB_NAME' from the snapshot…"
  turso db destroy "$DB_NAME" --yes
fi
turso db create "$DB_NAME" --from-file "$STAGE"

rm -f "$STAGE" "$STAGE-wal" "$STAGE-shm"
echo
echo "✅ Pushed to Turso db '$DB_NAME'."
turso db show "$DB_NAME" --url
echo "Token:  turso db tokens create $DB_NAME"
