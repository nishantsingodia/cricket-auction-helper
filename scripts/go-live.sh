#!/usr/bin/env bash
# One command to put the auction board online.
#
#   1. create/replace the Turso database from the local SQLite file
#   2. mint a DB token
#   3. set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN on the Vercel project
#   4. deploy to production
#
# PREREQUISITE (interactive, one time):  turso auth login
#
# Usage: scripts/go-live.sh [db-name]
set -euo pipefail

DB_NAME="${1:-cricket-auction}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v turso  >/dev/null || { echo "turso CLI not found."; exit 1; }
command -v vercel >/dev/null || { echo "vercel CLI not found: npm i -g vercel"; exit 1; }

if ! turso auth whoami >/dev/null 2>&1; then
  echo "⛔ Not logged in to Turso. Run this first, then re-run me:"
  echo
  echo "    turso auth login"
  exit 1
fi
vercel whoami >/dev/null 2>&1 || { echo "⛔ Not logged in to Vercel. Run: vercel login"; exit 1; }

echo "──────────── 1/4  push the database ────────────"
bash "$ROOT/scripts/turso-push.sh" "$DB_NAME"

echo
echo "──────────── 2/4  mint a token ────────────"
DB_URL="$(turso db show "$DB_NAME" --url)"
DB_TOKEN="$(turso db tokens create "$DB_NAME")"
echo "  url: $DB_URL"

echo
echo "──────────── 3/4  set Vercel env ────────────"
# Link non-interactively on first run.
[ -d .vercel ] || vercel link --yes >/dev/null

for ENV in production preview; do
  for KEY in TURSO_DATABASE_URL TURSO_AUTH_TOKEN; do
    vercel env rm "$KEY" "$ENV" --yes >/dev/null 2>&1 || true
  done
  # `vercel env add` reads the VALUE from stdin. Piping an empty stream stores an
  # empty string silently, so always feed it with printf and no trailing newline.
  printf '%s' "$DB_URL"   | vercel env add TURSO_DATABASE_URL "$ENV" >/dev/null
  printf '%s' "$DB_TOKEN" | vercel env add TURSO_AUTH_TOKEN  "$ENV" >/dev/null
  echo "  set for $ENV"
done

echo
echo "──────────── 4/4  deploy ────────────"
vercel deploy --prod

echo
echo "✅ Live. Two things to remember:"
echo "   • The CLOUD is now master while you run an auction from your phone."
echo "     Run  npm run turso:pull   afterwards to bring sales back to the laptop."
echo "   • After any local ETL / re-valuation, run  npm run turso:push  to update the cloud."
