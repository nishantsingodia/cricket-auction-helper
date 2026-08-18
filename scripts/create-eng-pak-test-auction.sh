#!/usr/bin/env bash
# Recreate the ENG v PAK Test auction (pool + valuation) from the squad file.
#
# WHY THIS EXISTS: scripts/turso-pull.sh replaces ALL local auction state, so a pull deletes this
# auction along with everything else and it has to be rebuilt. That is cheap and safe — the pool is
# rebuilt from src/lib/squads/eng-vs-pak-test-2026.ts and the valuation is deterministic, so you get
# byte-identical prices. It also means the auction gets a FRESH id, which is the point: the first
# attempt collided with a cloud auction already using id 40.
#
# ORDER MATTERS:  turso:pull  ->  this script  ->  turso:push / go-live
# Run it the other way round and the push is refused (cloud ahead on sold rows), or worse, accepted
# and it wipes sales made on the phone.
#
# Usage: bash scripts/create-eng-pak-test-auction.sh
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
NAME="${NAME:-ENG v PAK Test P<>N}"
TOURNAMENT="England vs Pakistan Men's Test 2026"

command -v jq >/dev/null || { echo "jq not found: brew install jq"; exit 1; }

curl -sf -o /dev/null "$BASE/" || {
  echo "⛔ Dev server is not up at $BASE — run 'npm run dev' first."
  exit 1
}

# Guard: refuse to create a duplicate if this tour already has an auction locally.
EXISTING="$(curl -s "$BASE/api/auctions" | jq -r --arg t "$TOURNAMENT" \
  '[.auctions // . | .[]? | select(.tournament_name == $t or .tournamentName == $t) | .id] | join(",")' 2>/dev/null || echo "")"
if [ -n "${EXISTING:-}" ] && [ "$EXISTING" != "null" ]; then
  echo "⚠️  This tour already has local auction(s): $EXISTING"
  echo "    Delete them first, or set NAME= and edit this guard, if you really want a second one."
  exit 1
fi

echo "──────── 1/2  create the auction ────────"
AUCTION_ID="$(curl -s -X POST "$BASE/api/auctions" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg name "$NAME" --arg t "$TOURNAMENT" '{
        name: $name, tournamentName: $t, matchFormat: "TEST",
        numFriends: 2, pursePerFriend: 400, playersPerFriend: 16,
        numCaptains: 3, numViceCaptains: 3, changesAllowed: 3,
        friends: [
          {name: "Nishant", shortName: "Ni", isMe: true},
          {name: "Pushap",  shortName: "Pu", isMe: false}
        ]
      }')" | jq -r '.auctionId')"

[ -n "$AUCTION_ID" ] && [ "$AUCTION_ID" != "null" ] || { echo "⛔ Auction creation failed."; exit 1; }
echo "  auction id: $AUCTION_ID"

echo "──────── 2/2  build pool + value ────────"
# buildTestPool resolves by cricsheet id only and THROWS on a miss, so a non-zero unmatched count
# here means the red-ball ETL has not run — not that a player needs a fuzzy alias.
curl -s -X POST "$BASE/api/pool/fetch" \
  -H 'Content-Type: application/json' \
  -d "{\"auctionId\": $AUCTION_ID}" \
  | jq '{players, matched, created, unmatched, teamBreakdown}'

echo
echo "✅ Board: $BASE/auction/$AUCTION_ID"
echo "   Sanity check — the top (friends x players-each) prices should sum to friends x purse (800):"
sqlite3 -header -column "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/db/cricket-auction.db" \
  "SELECT COUNT(*) AS pool, ROUND(SUM(val_expected),0) AS price_sum
     FROM auction_pool WHERE auction_id = $AUCTION_ID;"
