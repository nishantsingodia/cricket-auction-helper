#!/usr/bin/env bash
# Pull the AUCTION STATE back down from Turso (cloud) into the local SQLite file.
#
# WHEN TO RUN: after an auction you ran from your phone, before doing anything locally.
#
# Only the four mutable auction tables come back — auctions, auction_participants, auction_pool,
# watchlist. The reference data (players, match_performances, career_stats, venues, …) is NOT
# touched: local is the master for those, since the ETL and valuation pipeline run on the laptop.
#
# Usage: scripts/turso-pull.sh [db-name]
set -euo pipefail

DB_NAME="${1:-cricket-auction}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DB="$ROOT/db/cricket-auction.db"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/db/cricket-auction.db.bak-preTursoPull-$STAMP"
DUMP="$ROOT/db/.turso-pull-$STAMP.sql"

command -v turso >/dev/null || { echo "turso CLI not found."; exit 1; }
turso auth whoami >/dev/null 2>&1 || { echo "Not logged in. Run: turso auth login"; exit 1; }

# CLAUDE.md rule: always back up before an auction-state mutation.
echo "Backing up local DB -> $(basename "$BACKUP")"
sqlite3 "$LOCAL_DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
cp "$LOCAL_DB" "$BACKUP"

echo "Dumping auction tables from Turso '$DB_NAME'…"
: > "$DUMP"
for T in auctions auction_participants auction_pool watchlist; do
  turso db shell "$DB_NAME" ".dump $T" >> "$DUMP"
done

# Strip schema statements — we only want the rows; the local schema is already correct.
grep -E '^INSERT INTO' "$DUMP" > "$DUMP.rows" || true
ROWS=$(wc -l < "$DUMP.rows" | tr -d ' ')
echo "  $ROWS row statements"

if [ "$ROWS" -eq 0 ]; then
  echo "⛔ Nothing came back — aborting rather than wiping local auction state."
  rm -f "$DUMP" "$DUMP.rows"
  exit 1
fi

echo "Replacing local auction state…"
sqlite3 "$LOCAL_DB" <<SQL
BEGIN;
DELETE FROM watchlist;
DELETE FROM auction_pool;
DELETE FROM auction_participants;
DELETE FROM auctions;
.read $DUMP.rows
COMMIT;
SQL

rm -f "$DUMP" "$DUMP.rows"
echo
echo "✅ Auction state pulled from '$DB_NAME'."
sqlite3 -header -column "$LOCAL_DB" \
  "SELECT a.id, a.name, a.status, COUNT(CASE WHEN ap.status='SOLD' THEN 1 END) AS sold
     FROM auctions a LEFT JOIN auction_pool ap ON ap.auction_id = a.id
    GROUP BY a.id ORDER BY a.id DESC LIMIT 5;"
echo
echo "Backup kept at: $BACKUP"
