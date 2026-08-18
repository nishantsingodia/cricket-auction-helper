#!/usr/bin/env bash
# Pull the AUCTION STATE back down from Turso (cloud) into the local SQLite file.
#
# WHEN TO RUN: this is now a DEBUGGING/INSPECTION tool, not part of the normal flow.
# Turso is the master for auction state and `npm run turso:sync` folds the pull into the push, so you
# no longer have to remember "pull after the phone" before shipping data up. Reach for this only when
# you want the cloud's auctions in the local file to poke at them with sqlite3 — and remember the
# local copy is then just a copy: the next sync takes auction state from the cloud regardless.
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

echo "Reading auction tables from Turso '$DB_NAME'…"
# This used to be `turso db shell "$DB" ".dump $T"` per table, which is BROKEN: turso CLI v1.0.32
# rejects a table argument to .dump, so it captured zero rows every time and this script always fell
# into its own "nothing came back" abort. Reads now go through the libsql HTTP API helper, which
# returns typed JSON (and so does not mangle long risk_note text the way the shell's padded table
# output does). The helper emits INSERTs for every cloud-owned table in one pass.
HELPER="$ROOT/scripts/turso_auction_state.py"
[ -f "$HELPER" ] || { echo "⛔ Missing $HELPER"; exit 1; }
export TURSO_DB_URL="$(turso db show "$DB_NAME" --url 2>/dev/null | tr -d '\r\n ')"
export TURSO_DB_TOKEN="$(turso db tokens create "$DB_NAME" 2>/dev/null | tail -1 | tr -d '\r\n ')"
[ -n "$TURSO_DB_URL" ] && [ -n "$TURSO_DB_TOKEN" ] || { echo "⛔ Could not get a URL/token for '$DB_NAME'"; exit 1; }

python3 "$HELPER" dump > "$DUMP.rows" 2> "$DUMP.log" || {
  echo "⛔ Failed to read cloud auction state:"; sed 's/^/     /' "$DUMP.log"; exit 1; }
grep -E '^-- .*[1-9][0-9]* rows$' "$DUMP.log" | sed 's/^-- /  /' || true
ROWS=$(grep -c '^INSERT INTO' "$DUMP.rows" || true)
echo "  $ROWS row statements"

if [ "$ROWS" -eq 0 ]; then
  echo "⛔ Nothing came back — aborting rather than wiping local auction state."
  rm -f "$DUMP" "$DUMP.rows" "$DUMP.log"
  exit 1
fi

echo "Replacing local auction state…"
# The DELETE list must cover EVERY table the helper emits, children before parents — otherwise the
# incoming INSERTs collide on primary keys for the tables that were not cleared (tournaments was the
# one that used to be missed).
sqlite3 "$LOCAL_DB" <<SQL
PRAGMA foreign_keys=OFF;
BEGIN;
DELETE FROM auction_pool;
DELETE FROM auction_participants;
DELETE FROM watchlist;
DELETE FROM tournament_teams;
DELETE FROM team_captains;
DELETE FROM match_fantasy_scores;
DELETE FROM match_results;
DELETE FROM leaderboard;
DELETE FROM retained_players;
DELETE FROM auctions;
DELETE FROM tournaments;
.read $DUMP.rows
COMMIT;
SQL

rm -f "$DUMP" "$DUMP.rows" "$DUMP.log"
echo
echo "✅ Auction state pulled from '$DB_NAME'."
sqlite3 -header -column "$LOCAL_DB" \
  "SELECT a.id, a.name, a.status, COUNT(CASE WHEN ap.status='SOLD' THEN 1 END) AS sold
     FROM auctions a LEFT JOIN auction_pool ap ON ap.auction_id = a.id
    GROUP BY a.id ORDER BY a.id DESC LIMIT 5;"
echo
echo "Backup kept at: $BACKUP"
