#!/usr/bin/env bash
# Regenerate the Women's T20 WC 2026 Dream11 fantasy-points sheet.
# Pulls every COMPLETED match (cached scorecards are reused; new matches added),
# writes a CSV you import into the Google Sheet (File > Import > Upload > Replace).
#
#   bash data/refresh_fps.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."
# load CRICKET_API_KEY from .env.local
export $(grep -E '^CRICKET_API_KEY=' .env.local | xargs)
OUT="${1:-$HOME/Desktop/WWC2026_fantasy_points.csv}"

# Refresh cricsheet (gold source: exact dots/maidens/XI). ~21MB; posts internationals
# with a ~1-3 day lag, so the newest matches fall back to cricapi until then.
CS_DIR="${CRICSHEET_DIR:-/tmp/t20scan}"
echo "refreshing cricsheet ball-by-ball..."
curl -s -o /tmp/t20s_json.zip "https://cricsheet.org/downloads/t20s_json.zip" && \
  mkdir -p "$CS_DIR" && unzip -o -q /tmp/t20s_json.zip "*.json" -d "$CS_DIR" 2>/dev/null || \
  echo "  (cricsheet refresh failed; using whatever is already in $CS_DIR)"
export CRICSHEET_DIR="$CS_DIR"

python3 data/wc_fps_to_csv.py "$OUT"
echo "Done -> $OUT"
