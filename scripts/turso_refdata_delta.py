#!/usr/bin/env python3
"""Top up the CLOUD's reference data with match_performances rows it is missing — surgically,
over the libsql HTTP API, with no destroy/create and no token churn.

This is the safe alternative to `npm run turso:sync` when the cloud holds auctions people may be
bidding on (see CLAUDE.md: turso:sync is destroy-then-create, and a failed create has twice left
NO cloud database). It only ever INSERTs rows the cloud does not have; it never updates or deletes.

What it does, per format (default TEST,FC — the red-ball delta):
  1. local match_ids minus cloud match_ids  -> the missing matches
  2. players in those rows are mapped local->cloud by CRICSHEET_ID (never by name or local id —
     ids drift between the two copies). A player the cloud lacks is INSERTED first (FK).
  3. venues mapped by exact name; a missing venue is inserted.
  4. the rows are inserted WITHOUT the id column, so the cloud autoincrements.

Dry run by default. APPLY=1 to write.
Env: TURSO_DB_URL, TURSO_DB_TOKEN  (token: `turso db tokens create cricket-auction`)
Usage: TURSO_DB_URL=libsql://cricket-auction-nishantsingodia.aws-ap-south-1.turso.io \
       TURSO_DB_TOKEN=$(turso db tokens create cricket-auction) python3 scripts/turso_refdata_delta.py
"""
import json
import os
import sqlite3
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from turso_auction_state import endpoint  # noqa: E402

LOCAL = os.path.join(os.path.dirname(__file__), "..", "db", "cricket-auction.db")
FORMATS = [f.strip() for f in os.environ.get("FORMATS", "TEST,FC").split(",") if f.strip()]
APPLY = os.environ.get("APPLY") == "1"
BATCH = 150


def _val(v):
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


def pipeline(stmts):
    """Run [(sql, args)] in ONE request; returns each statement's rows (typed cells unwrapped)."""
    token = (os.environ.get("TURSO_DB_TOKEN") or "").strip() or sys.exit("TURSO_DB_TOKEN is not set")
    reqs = [{"type": "execute", "stmt": {"sql": s, "args": [_val(a) for a in args]}} for s, args in stmts]
    body = json.dumps({"requests": reqs + [{"type": "close"}]}).encode()
    req = urllib.request.Request(endpoint(), data=body, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.load(resp)
    out = []
    for r in payload["results"][: len(stmts)]:
        if r.get("type") == "error":
            raise RuntimeError(r.get("error", {}).get("message", "libsql error"))
        res = r["response"]["result"]
        out.append([[c.get("value") if c.get("type") != "null" else None for c in row] for row in res.get("rows", [])])
    return out


def q(sql, args=()):
    return pipeline([(sql, list(args))])[0]


def in_chunks(xs, n=400):
    xs = list(xs)
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def main():
    loc = sqlite3.connect(LOCAL)
    loc.row_factory = sqlite3.Row
    fmt_ph = ",".join("?" * len(FORMATS))

    local_ids = {r[0] for r in loc.execute(
        f"SELECT DISTINCT match_id FROM match_performances WHERE format IN ({fmt_ph})", FORMATS)}
    cloud_ids = {r[0] for r in q(
        f"SELECT DISTINCT match_id FROM match_performances WHERE format IN ({fmt_ph})", FORMATS)}
    missing = sorted(local_ids - cloud_ids)
    cloud_only = len(cloud_ids - local_ids)
    print(f"formats {FORMATS}: local {len(local_ids)} matches, cloud {len(cloud_ids)}, "
          f"missing in cloud {len(missing)}, cloud-only {cloud_only}")
    if not missing:
        return

    rows = []
    for chunk in in_chunks(missing):
        ph = ",".join("?" * len(chunk))
        rows += loc.execute(
            f"""SELECT mp.*, p.cricsheet_id AS _csid FROM match_performances mp
                JOIN players p ON p.id = mp.player_id WHERE mp.match_id IN ({ph})""", chunk).fetchall()
    nocsid = [r for r in rows if not r["_csid"]]
    if nocsid:
        sys.exit(f"{len(nocsid)} delta rows belong to players with no cricsheet_id — cannot map safely")
    print(f"  {len(rows)} rows; date range {min(r['match_date'] for r in rows)} .. {max(r['match_date'] for r in rows)}")

    # --- players: map by cricsheet_id, insert the ones the cloud lacks ---
    csids = sorted({r["_csid"] for r in rows})
    cmap = {}
    for chunk in in_chunks(csids):
        for cid, csid in q(f"SELECT id, cricsheet_id FROM players WHERE cricsheet_id IN ({','.join('?'*len(chunk))})", chunk):
            if csid in cmap:
                sys.exit(f"cloud has duplicate players rows for cricsheet_id {csid} — dedup first")
            cmap[csid] = int(cid)
    new_players = [c for c in csids if c not in cmap]
    print(f"  players: {len(csids)} referenced, {len(new_players)} missing in cloud")
    pcols = ["cricsheet_id", "cricinfo_id", "name", "full_name", "country", "dob", "role",
             "bat_style", "bowl_style", "is_overseas", "profile_url", "gender"]

    # --- venues: map by exact name ---
    local_vname = {r["id"]: r["name"] for r in loc.execute("SELECT id, name FROM venues")}
    need_v = sorted({local_vname[r["venue_id"]] for r in rows if r["venue_id"] is not None})
    vmap = {}
    for chunk in in_chunks(need_v):
        for vid, nm in q(f"SELECT id, name FROM venues WHERE name IN ({','.join('?'*len(chunk))})", chunk):
            vmap.setdefault(nm, int(vid))
    new_venues = [v for v in need_v if v not in vmap]
    print(f"  venues: {len(need_v)} referenced, {len(new_venues)} missing in cloud {new_venues[:5]}")

    if not APPLY:
        print("DRY RUN — nothing written. Re-run with APPLY=1.")
        return

    for csid in new_players:
        pr = loc.execute(f"SELECT {','.join(pcols)} FROM players WHERE cricsheet_id = ?", (csid,)).fetchone()
        q(f"INSERT INTO players ({','.join(pcols)}) VALUES ({','.join('?'*len(pcols))})", list(pr))
        cmap[csid] = int(q("SELECT id FROM players WHERE cricsheet_id = ?", (csid,))[0][0])
    for nm in new_venues:
        vr = loc.execute("SELECT name, city, country FROM venues WHERE name = ?", (nm,)).fetchone()
        q("INSERT INTO venues (name, city, country) VALUES (?, ?, ?)", list(vr))
        vmap[nm] = int(q("SELECT id FROM venues WHERE name = ?", (nm,))[0][0])

    mcols = [c for c in rows[0].keys() if c not in ("id", "_csid")]
    sql = f"INSERT INTO match_performances ({','.join(mcols)}) VALUES ({','.join('?'*len(mcols))})"
    stmts = []
    for r in rows:
        vals = []
        for c in mcols:
            v = r[c]
            if c == "player_id":
                v = cmap[r["_csid"]]
            elif c == "venue_id" and v is not None:
                v = vmap[local_vname[v]]
            vals.append(v)
        stmts.append((sql, vals))
    done = 0
    for i in range(0, len(stmts), BATCH):
        pipeline(stmts[i : i + BATCH])
        done += len(stmts[i : i + BATCH])
    after = {r[0] for r in q(f"SELECT DISTINCT match_id FROM match_performances WHERE format IN ({fmt_ph})", FORMATS)}
    print(f"inserted {done} rows; cloud still missing {len(local_ids - after)} matches")


if __name__ == "__main__":
    main()
