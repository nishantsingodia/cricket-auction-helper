#!/usr/bin/env python3
"""Read AUCTION STATE out of a Turso database over the libsql HTTP API.

Used by scripts/turso-sync.sh, which needs the cloud's auction rows so it can carry them through a
reference-data upload untouched.

WHY NOT `turso db shell`: as of turso CLI v1.0.32 `.dump <table>` is rejected ("unknown command or
invalid arguments"), so the dump-and-grep approach silently captures ZERO rows — which is what
scripts/turso-pull.sh does, and why it has been aborting on its own "nothing came back" guard. And the
shell's only other output mode is a human-formatted table that pads every column to the widest value,
which mangles long text (auction_pool.risk_note holds multi-sentence notes). The HTTP API returns
typed JSON instead, so values survive exactly.

Modes:
  fingerprint   one line: pool/sold/spend/auctions/purses — a cheap signature of auction state, used
                to detect somebody bidding mid-sync
  dump          SQL INSERT statements for every auction-state table, on stdout

Env: TURSO_DB_URL (libsql:// or https://), TURSO_DB_TOKEN
"""
import json
import os
import sys
import urllib.request

# Cloud-owned tables, children before parents so the emitted INSERTs load cleanly.
AUCTION_TABLES = [
    "tournaments",
    "auctions",
    "auction_participants",
    "auction_pool",
    "tournament_teams",
    "team_captains",
    "match_results",
    "match_fantasy_scores",
    "leaderboard",
    "retained_players",
    "watchlist",
]


def endpoint() -> str:
    url = (os.environ.get("TURSO_DB_URL") or "").strip()
    if not url:
        sys.exit("TURSO_DB_URL is not set")
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    return url.rstrip("/") + "/v2/pipeline"


def query(sql: str):
    """Run one statement, return (cols, rows) with rows as typed dicts."""
    token = (os.environ.get("TURSO_DB_TOKEN") or "").strip()
    if not token:
        sys.exit("TURSO_DB_TOKEN is not set")
    body = json.dumps(
        {"requests": [{"type": "execute", "stmt": {"sql": sql}}, {"type": "close"}]}
    ).encode()
    req = urllib.request.Request(
        endpoint(),
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.load(resp)

    first = payload["results"][0]
    if first.get("type") == "error":
        raise RuntimeError(first.get("error", {}).get("message", "unknown libsql error"))
    result = first["response"]["result"]
    cols = [c.get("name") for c in result.get("cols", [])]
    return cols, result.get("rows", [])


def lit(cell: dict) -> str:
    """Render one typed libsql cell as a SQL literal."""
    t = cell.get("type")
    if t == "null":
        return "NULL"
    v = cell.get("value")
    if t == "integer":
        return str(int(v))
    if t == "float":
        return repr(float(v))
    if t == "blob":
        raw = cell.get("base64") or v or ""
        import base64
        return "X'" + base64.b64decode(raw).hex() + "'"
    # text, and anything unexpected, is quoted as text
    return "'" + str(v).replace("'", "''") + "'"


def cmd_fingerprint() -> None:
    _, rows = query(
        """SELECT (SELECT COUNT(*) FROM auction_pool)
           ||'/'||(SELECT COALESCE(SUM(status='SOLD'),0) FROM auction_pool)
           ||'/'||(SELECT COALESCE(SUM(COALESCE(sold_price,0)),0) FROM auction_pool)
           ||'/'||(SELECT COUNT(*) FROM auctions)
           ||'/'||(SELECT COALESCE(SUM(COALESCE(remaining_purse,0)),0) FROM auction_participants)"""
    )
    print(rows[0][0].get("value") if rows else "")


def cmd_dump() -> None:
    total = 0
    for table in AUCTION_TABLES:
        try:
            cols, rows = query(f"SELECT * FROM {table}")
        except RuntimeError as e:
            # A table missing in the cloud is not fatal — the schema may predate it.
            print(f"-- skipped {table}: {e}", file=sys.stderr)
            continue
        if not rows:
            print(f"-- {table}: 0 rows", file=sys.stderr)
            continue
        collist = ", ".join(f'"{c}"' for c in cols)
        for r in rows:
            values = ", ".join(lit(c) for c in r)
            print(f'INSERT INTO "{table}" ({collist}) VALUES ({values});')
        total += len(rows)
        print(f"-- {table}: {len(rows)} rows", file=sys.stderr)
    print(f"-- TOTAL {total} rows", file=sys.stderr)
    if total == 0:
        sys.exit("refusing to report success: extracted 0 auction rows")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "fingerprint":
        cmd_fingerprint()
    elif mode == "dump":
        cmd_dump()
    else:
        sys.exit(__doc__)
