#!/usr/bin/env bash
# ⛔ RETIRED — this replaced the WHOLE cloud database from the local file, including auction state.
#
# That made the cloud's auctions, pools, purses and sales collateral damage of a data refresh, and
# left correctness resting on the human remembering "pull after the phone, push after the laptop".
# On 2026-08-18 that model produced an id collision (a locally-created auction vs a cloud auction
# both on id 40) and a refused deploy. Its safety check compared TOTAL sold rows, so it could also
# have passed while silently wiping a single live auction.
#
# Use instead:
#
#     npm run turso:sync
#
# which ships local REFERENCE data up while carrying the cloud's AUCTION state through untouched,
# verifies referential integrity, and aborts if anyone bids mid-sync. It is order-independent, so
# there is no longer a rule to remember.
set -euo pipefail
echo "⛔ scripts/turso-push.sh is retired — it overwrote cloud auction state."
echo
echo "   Use:  npm run turso:sync     (reference data up, auction state preserved)"
echo
echo "   If you genuinely need to force the local auction tables into the cloud — which DESTROYS"
echo "   whatever was bid on the phone — do it deliberately and read scripts/turso-sync.sh first."
exit 1
