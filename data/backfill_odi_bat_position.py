#!/usr/bin/env python3
"""
Fill match_performances.bat_position for ODI rows from the raw cricsheet JSON.

etl_cricsheet.py never writes bat_position, and the T20 values came from an old one-off backfill
that was never run for ODIs — so until 15 Oct 2026 every ODI row had NULL, and ODI boards had no
batting-order data to seed probable XIs from.

Position = order of first appearance as batter or non-striker in each innings (cricsheet lists both
openers on the first ball). Players are joined through the match file's own registry
(name -> cricsheet_id), never by name. Only touches bat_position on format='ODI' rows; idempotent.

Usage:  python3 data/backfill_odi_bat_position.py
"""
import json, os, sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "..", "db", "cricket-auction.db")
RAW = os.path.join(HERE, "raw", "odi")


def main():
    db = sqlite3.connect(DB)
    cs2id = {cs: pid for pid, cs in db.execute(
        "SELECT id, cricsheet_id FROM players WHERE cricsheet_id IS NOT NULL")}
    odi_matches = {r[0] for r in db.execute(
        "SELECT DISTINCT match_id FROM match_performances WHERE format='ODI'")}
    files = updated = 0
    for f in os.listdir(RAW):
        mid = f[:-5]
        if not f.endswith(".json") or mid not in odi_matches:
            continue
        with open(os.path.join(RAW, f)) as fh:
            d = json.load(fh)
        reg = d["info"].get("registry", {}).get("people", {})
        files += 1
        for inn in d.get("innings", [])[:2]:  # super overs excluded
            order = []
            for ov in inn.get("overs", []):
                for dl in ov["deliveries"]:
                    for n in (dl["batter"], dl["non_striker"]):
                        if n not in order:
                            order.append(n)
            for pos, n in enumerate(order, 1):
                pid = cs2id.get(reg.get(n))
                if pid is None:
                    continue
                updated += db.execute(
                    "UPDATE match_performances SET bat_position=? "
                    "WHERE match_id=? AND player_id=? AND format='ODI'",
                    (pos, mid, pid)).rowcount
    db.commit()
    total, filled = db.execute(
        "SELECT COUNT(*), SUM(bat_position IS NOT NULL) FROM match_performances WHERE format='ODI'"
    ).fetchone()
    print(f"  ODI bat_position: {files} matches scanned, {updated} rows set; {filled}/{total} filled")


if __name__ == "__main__":
    main()
