#!/usr/bin/env bash
# Create the ENG v PAK Test auction (pool + valuation) from the squad file.
#
# POINT THIS AT TURSO, NOT AT THE LOCAL FILE. Turso is the master for auction state, so an auction
# created in the local sqlite file is discarded by the next `npm run turso:sync`. Creating it against
# the cloud also means the id is minted in exactly one place, which is what makes the id collision
# that bit us on 2026-08-18 (local auction 40 vs cloud "Pushap CPL Auction" 40) impossible.
#
# Rebuilding is cheap and lossless: the pool comes from src/lib/squads/eng-vs-pak-test-2026.ts and
# the valuation is deterministic, so prices come back identical.
#
# ORDER:  npm run turso:sync   (get the red-ball data up there first, or the pool build finds no
#                               TEST rows and buildTestPool throws)
#         then this script against the deployed URL.
#
# Usage:
#   BASE=https://cricket-auction-helper.vercel.app bash scripts/create-eng-pak-test-auction.sh
#   bash scripts/create-eng-pak-test-auction.sh          # local dev — only if TURSO_* is set in .env.local
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
PROD="https://cricket-auction-helper.vercel.app"
if [ "$BASE" = "http://localhost:3000" ]; then
  echo "⚠️  BASE is localhost. That only reaches Turso if TURSO_DATABASE_URL is set in .env.local;"
  echo "    otherwise this creates the auction in the local file and the next sync discards it."
  echo "    For the cloud:  BASE=$PROD bash $0"
  echo
fi
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
echo "   Sanity check — the whole 32-player pool should price to friends x purse (= 800):"
# Read this back THROUGH THE API, not from the local sqlite file: when BASE is the deployed app the
# rows live in Turso and the local file knows nothing about them.
curl -s "$BASE/api/auction/$AUCTION_ID" \
  | jq '{pool: ([.pool[]?] | length), price_sum: ([.pool[]?.val_expected // 0] | add | round)}' \
  2>/dev/null || echo "   (could not read back — open the board URL above)"
