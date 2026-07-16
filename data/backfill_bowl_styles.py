#!/usr/bin/env python3
"""
Backfill players.bowl_style from an EXACT, free, bulk source chain (no fuzzy matching):

  cricsheet people register  (cricsheet_id -> Cricinfo ID)
    -> Wikidata SPARQL P2697  (Cricinfo ID -> Wikipedia article title)
    -> Wikipedia infobox       (`| bowling = ...` -> raw style string)
    -> spin/pace classifier

This replaces the hand-maintained bowler-style map (src/lib/venues/bowler-styles.ts) as the
PRIMARY source of the venue spin/pace split. The hand map stays as a fallback/override for
players Wikipedia doesn't cover. cricapi is NOT used (free tier = 100 hits/day — unusable at
this volume); ESPN blocks scraping (403). Wikidata + Wikipedia have no hard quota.

Idempotent + resumable: results cache to data/bowler_styles.json; re-runs skip cached ids.
Only touches players.bowl_style (a player attribute) — never auction_pool / purses.

Usage:  python3 data/backfill_bowl_styles.py [--limit N] [--all-players]
        (default: only players with bowling records — the set that matters for the venue view)
"""
import json, os, re, sqlite3, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "..", "db", "cricket-auction.db")
REGISTER = os.path.join(HERE, "raw", "people.csv")
CACHE = os.path.join(HERE, "bowler_styles.json")
UA = "cricket-auction-bowl-style-backfill/1.0 (personal fantasy tool)"

REGISTER_URL = "https://cricsheet.org/register/people.csv"
WD_SPARQL = "https://query.wikidata.org/sparql"
WIKI_API = "https://en.wikipedia.org/w/api.php"


def http_get(url, params=None, headers=None, retries=5):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                wait = 65  # WDQS rate-limit is per-minute; wait it out
                print(f"  … 429 rate-limited, waiting {wait}s (attempt {attempt+1})")
                time.sleep(wait)
                continue
            if attempt == retries - 1:
                print(f"  ! GET failed ({e}) for {url[:70]}")
                return None
            time.sleep(2 * (attempt + 1))
        except Exception as e:
            if attempt == retries - 1:
                print(f"  ! GET failed ({e}) for {url[:70]}")
                return None
            time.sleep(2 * (attempt + 1))
    return None


def wikidata_query(sparql, retries=5):
    """POST a SPARQL query to WDQS (POST has no URL-length limit → big VALUES batches are safe;
    GET 414'd at ~1000 ids). Returns response text or None."""
    body = urllib.parse.urlencode({"query": sparql, "format": "json"}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(WD_SPARQL, data=body, headers={
                "User-Agent": UA, "Accept": "application/sparql-results+json",
                "Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                print(f"  … WD 429, waiting 65s (attempt {attempt+1})")
                time.sleep(65)
                continue
            if attempt == retries - 1:
                print(f"  ! WD POST failed ({e})")
                return None
            time.sleep(2 * (attempt + 1))
        except Exception as e:
            if attempt == retries - 1:
                print(f"  ! WD POST failed ({e})")
                return None
            time.sleep(2 * (attempt + 1))
    return None


def classify(raw: str):
    """Raw infobox bowling text -> 'spin' | 'pace' | None. Strips wiki markup, picks the
    FIRST-mentioned discipline when a player bowls both."""
    if not raw:
        return None
    t = re.sub(r"[\[\]{}']", " ", raw).lower()
    t = re.sub(r"<[^>]+>", " ", t)
    SPIN = ["break", "spin", "orthodox", "googly", "chinaman", "slow left", "legspin",
            "off spin", "leg spin", "off-spin", "leg-spin", "tweak"]
    PACE = ["fast", "medium", "seam", "swing", "pace", "quick"]
    spin_at = min([t.find(k) for k in SPIN if k in t], default=-1)
    pace_at = min([t.find(k) for k in PACE if k in t], default=-1)
    if spin_at == -1 and pace_at == -1:
        return None
    if spin_at == -1:
        return "pace"
    if pace_at == -1:
        return "spin"
    return "spin" if spin_at <= pace_at else "pace"  # first-listed = primary


def load_register():
    if not os.path.exists(REGISTER):
        print("Downloading cricsheet people register…")
        txt = http_get(REGISTER_URL)
        if not txt:
            sys.exit("Could not download people register.")
        os.makedirs(os.path.dirname(REGISTER), exist_ok=True)
        open(REGISTER, "w").write(txt)
    import csv
    cs_to_cricinfo = {}
    with open(REGISTER) as f:
        for row in csv.DictReader(f):
            cid = (row.get("key_cricinfo") or "").strip()
            ident = (row.get("identifier") or "").strip()
            if ident and cid:
                cs_to_cricinfo[ident] = cid
    return cs_to_cricinfo


def wikidata_titles(cricinfo_ids):
    """Batch cricinfo_id -> enwiki article title via P2697. Big VALUES chunks (fewer requests →
    survives WDQS rate-limiting). Returns (titles, ok_cids) where ok_cids = ids covered by a
    SUCCESSFUL batch, so genuine misses can be cached but transient failures retry next run."""
    out, ok = {}, set()
    ids = list(cricinfo_ids)
    CHUNK = 500
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i:i + CHUNK]
        values = " ".join(f'"{c}"' for c in chunk)
        q = f"""SELECT ?cid ?article WHERE {{
            VALUES ?cid {{ {values} }}
            ?item wdt:P2697 ?cid .
            ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
        }}"""
        res = wikidata_query(q)  # POST (GET 414'd on big VALUES batches)
        if res:
            try:
                for b in json.loads(res)["results"]["bindings"]:
                    cid = b["cid"]["value"]
                    title = b["article"]["value"].rsplit("/", 1)[-1]
                    out[cid] = urllib.parse.unquote(title).replace("_", " ")
                ok.update(chunk)  # batch succeeded → these ids are settled
            except Exception as e:
                print(f"  ! WD parse fail: {e}")
        print(f"  Wikidata {min(i+CHUNK,len(ids))}/{len(ids)} → {len(out)} titles ({len(ok)} settled)")
        time.sleep(2)
    return out, ok


def wikipedia_bowling(titles):
    """Batch article title -> raw `| bowling =` infobox value. 50 titles/request."""
    out = {}
    tl = list(titles)
    for i in range(0, len(tl), 50):
        chunk = tl[i:i + 50]
        res = http_get(WIKI_API, {
            "action": "query", "prop": "revisions", "rvprop": "content",
            "rvslots": "main", "format": "json", "titles": "|".join(chunk),
            "redirects": 1,
        })
        if res:
            try:
                data = json.loads(res)
                norm = {n["from"]: n["to"] for n in data["query"].get("normalized", [])}
                redir = {r["from"]: r["to"] for r in data["query"].get("redirects", [])}
                pages = data["query"]["pages"]
                title_by_norm = {}
                for p in pages.values():
                    ttl = p.get("title")
                    revs = p.get("revisions")
                    if not revs:
                        continue
                    content = revs[0]["slots"]["main"].get("*", "")
                    m = re.search(r"\|\s*bowling\s*=\s*([^\n|]+)", content, re.I)
                    title_by_norm[ttl] = m.group(1).strip() if m else ""
                # map requested title -> resolved (normalized+redirect) -> value
                for req in chunk:
                    t = norm.get(req, req)
                    t = redir.get(t, t)
                    if t in title_by_norm:
                        out[req] = title_by_norm[t]
            except Exception as e:
                print(f"  ! WP parse fail: {e}")
        print(f"  Wikipedia {min(i+50,len(tl))}/{len(tl)} → {len(out)} bowling fields")
        time.sleep(0.4)
    return out


def main():
    all_players = "--all-players" in sys.argv
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    conn = sqlite3.connect(DB, timeout=30)
    conn.execute("PRAGMA busy_timeout=30000")

    # target set: players with a cricsheet_id (optionally only those who have bowled)
    if all_players:
        rows = conn.execute(
            "SELECT id, cricsheet_id FROM players WHERE cricsheet_id IS NOT NULL AND cricsheet_id<>''"
        ).fetchall()
    else:
        rows = conn.execute("""
            SELECT DISTINCT p.id, p.cricsheet_id FROM players p
            JOIN match_performances mp ON mp.player_id=p.id
            WHERE p.cricsheet_id IS NOT NULL AND p.cricsheet_id<>'' AND mp.bowl_balls>0
        """).fetchall()
    if limit:
        rows = rows[:limit]
    print(f"Target players: {len(rows)}")

    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    cs_to_cricinfo = load_register()

    # only resolve players not already cached AND that have a cricinfo id
    todo = [(pid, cs) for pid, cs in rows if cs not in cache and cs in cs_to_cricinfo]
    print(f"Cached: {len(cache)} | to resolve: {len(todo)} | no cricinfo id: "
          f"{sum(1 for _,cs in rows if cs not in cs_to_cricinfo)}")

    if todo:
        cricinfo_for = {cs: cs_to_cricinfo[cs] for _, cs in todo}
        titles, ok_cids = wikidata_titles(set(cricinfo_for.values()))
        # cricsheet_id -> title (only where Wikidata returned an article)
        cs_title = {cs: titles[cid] for cs, cid in cricinfo_for.items() if cid in titles}
        bowling = wikipedia_bowling(set(cs_title.values()))
        for cs, title in cs_title.items():
            raw = bowling.get(title, "")
            cache[cs] = {"raw": raw, "type": classify(raw), "title": title}
        # Cache a genuine "no article" ONLY when its Wikidata batch actually succeeded — never
        # cache ids that failed transiently (WDQS 429/outage), so they retry on the next run.
        for _, cs in todo:
            cid = cricinfo_for[cs]
            if cs not in cache and cid in ok_cids:
                cache[cs] = {"raw": "", "type": None, "title": None}
        json.dump(cache, open(CACHE, "w"), indent=0)
        settled = sum(1 for e in cache.values())
        print(f"Cache written: {settled} entries → {CACHE}")

    # write players.bowl_style (raw string) for everything we have a type for
    updated = 0
    with conn:
        for pid, cs in rows:
            ent = cache.get(cs)
            if ent and ent.get("type"):
                conn.execute("UPDATE players SET bowl_style=? WHERE id=?", (ent["raw"], pid))
                updated += 1
    print(f"players.bowl_style updated: {updated}")

    spin = sum(1 for e in cache.values() if e.get("type") == "spin")
    pace = sum(1 for e in cache.values() if e.get("type") == "pace")
    unk = sum(1 for e in cache.values() if not e.get("type"))
    print(f"Classified — spin: {spin}  pace: {pace}  unresolved: {unk}")
    conn.close()


if __name__ == "__main__":
    main()
