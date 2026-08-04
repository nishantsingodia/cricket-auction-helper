#!/usr/bin/env python3
"""Build the canonical VENUE registry — the venue equivalent of the player registry.

WHY: cricsheet renamed most grounds ~2021/22 by appending the city, so one ground is stored under
2-4 different `venue_name` strings. 689 name rows are really ~500 grounds, and 67% of all matches sit
under a split name. Every venue read (bat/bowl classification, Bat Index, player-at-venue history)
therefore works off a fragment of the true sample, and grounds that should be well-sampled get
dropped as "too thin".

THE KEY CONSTRAINT: `match_performances.venue_name` is a plain STRING with no city attached. So the
deliverable is a map RAW STRING -> canonical ground. City is only used to DECIDE that grouping.

You cannot fold on ground name alone: "County Ground" is seven different grounds, "National Stadium"
is Karachi AND Hamilton, "Nehru Stadium" is four grounds. Algorithm:

  1. Group raw spellings by base name (text before the first comma).
  2. Collect the distinct cities those spellings were played in (city-alias-normalised).
  3. ONE city  -> one ground; fold every spelling together.
  4. MANY cities -> this base name covers several grounds. Assign each spelling that NAMES its
     location to that ground; a BARE spelling ("County Ground" with no suffix) is genuinely
     ambiguous and is left as its own unassignable bucket rather than guessed into one ground.

`espn_venue_id` is reserved and left null: ESPN blocks this network, so it gets backfilled later —
exactly how the player registry ran on `slug:` pids before the cricinfo ids landed.
"""
import json, os, re, sqlite3
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "db", "cricket-auction.db")
OUT = os.path.join(ROOT, "src", "lib", "registry", "venues.json")

# Same ground, two different city labels. Renames, suburbs and misspellings. Every entry MERGES two
# grounds, so each one is a deliberate claim — keep the list justified, not speculative.
CITY_ALIASES = {
    # India
    "bangalore": "bengaluru", "bombay": "mumbai", "calcutta": "kolkata", "madras": "chennai",
    "poona": "pune", "navi mumbai": "mumbai", "mullanpur": "mohali", "new chandigarh": "mohali",
    "chandigarh": "mohali", "dharmasala": "dharamsala",
    # Sri Lanka / Bangladesh / Pakistan
    "khettarama": "colombo", "mirpur": "dhaka", "chittagong": "chattogram", "kandy": "kandy",
    # South Africa
    "port elizabeth": "gqeberha",
    # England
    "hove": "brighton",
    # Netherlands
    "voorburg": "the hague",
}

# Base names that are genuinely SEVERAL different grounds. Everything else folds by base name,
# because a base name like "Brian Lara Stadium" or "Sabina Park" already identifies one ground —
# and island-vs-town city labels ("Trinidad" vs "Tarouba") must NOT be read as different grounds.
# Anything added here gets split by city instead; the review report below lists every folded group
# that spanned >1 city so a missed collision is visible rather than silent.
KNOWN_MULTI_GROUND = {
    "county ground",            # Bristol, Chelmsford, Derby, Hove, Northampton, Taunton, Worcester
    "national stadium",         # Karachi (PAK) and Hamilton (NZ)
    "nehru stadium",            # Pune, Kochi, Guwahati, Margao
    "gymkhana club ground",     # Nairobi (KEN) and Dar-es-Salaam (TAN)
    "university oval",          # Dunedin (NZ) and Hobart (AUS)
}

def norm_city(c):
    c = (c or "").strip().lower()
    return CITY_ALIASES.get(c, c)

def base_name(n):
    return n.split(",")[0].strip()

def slug(*parts):
    s = re.sub(r"[^a-z0-9]+", "-", " ".join(p for p in parts if p).lower())
    return re.sub(r"-+", "-", s).strip("-")

def main():
    conn = sqlite3.connect(DB)
    # matches per RAW spelling (counted once per string, never per venues row)
    counts = dict(conn.execute(
        "SELECT venue_name, COUNT(DISTINCT match_id) FROM match_performances "
        "WHERE venue_name IS NOT NULL GROUP BY venue_name").fetchall())
    # every (raw name -> cities it has been recorded in), from the venues table
    cities = defaultdict(set)
    countries = {}
    for name, city, country in conn.execute(
            "SELECT name, COALESCE(city,''), COALESCE(country,'') FROM venues"):
        if city.strip():
            cities[name].add(norm_city(city))
        if country.strip():
            countries.setdefault(name, country.strip())

    by_base = defaultdict(list)
    for name in counts:
        by_base[base_name(name)].append(name)

    registry = {}
    ambiguous = []
    folded_multi = []

    def add(key, canonical_pool, city, country):
        canon = sorted(canonical_pool, key=lambda a: (-counts.get(a, 0), -len(a)))[0]
        e = registry.setdefault(key, {
            "canonical": canon, "city": city or None, "country": country,
            "espn_venue_id": None, "matches": 0, "aliases": [],
        })
        for a in canonical_pool:
            if a not in e["aliases"]:
                e["aliases"].append(a)
                e["matches"] += counts.get(a, 0)
        # keep the most-used spelling as canonical
        e["canonical"] = sorted(e["aliases"], key=lambda a: (-counts.get(a, 0), -len(a)))[0]

    for base, names in by_base.items():
        city_set = set()
        for n in names:
            city_set |= cities.get(n, set())

        if base.lower() not in KNOWN_MULTI_GROUND:
            # One ground. Pick the most-played city label for display.
            city = ""
            if city_set:
                city = sorted(city_set, key=lambda c: -sum(
                    counts.get(n, 0) for n in names if c in cities.get(n, set())))[0]
            country = next((countries[n] for n in names if n in countries), None)
            add(slug(base, city), names, city, country)
            if len(city_set) > 1:
                folded_multi.append((base, sorted(city_set),
                                     sum(counts.get(n, 0) for n in names)))
            continue

        # A known multi-ground name -> split by city.
        for n in names:
            own = cities.get(n, set())
            if len(own) == 1:
                c = next(iter(own))
                add(slug(base, c), [n], c, countries.get(n))
            else:
                # bare or multi-city spelling: cannot be attributed to one ground
                add(slug(base, "unassigned"), [n], "", countries.get(n))
                ambiguous.append((n, counts.get(n, 0), sorted(own) or sorted(city_set)))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"venues": dict(sorted(registry.items()))}, f, indent=1, ensure_ascii=False)
        f.write("\n")

    folded = {k: v for k, v in registry.items() if len(v["aliases"]) > 1}
    print(f"raw venue_name strings : {len(counts)}")
    print(f"canonical grounds      : {len(registry)}")
    print(f"grounds that folded    : {len(folded)} (absorbing {sum(len(v['aliases']) for v in folded.values())} spellings)")
    print(f"AMBIGUOUS spellings    : {len(ambiguous)} (name shared by several grounds, no city on the string)")
    print(f"written to             : {os.path.relpath(OUT, ROOT)}")

    print("\nBIGGEST FOLDS:")
    for k, v in sorted(folded.items(), key=lambda kv: -kv[1]["matches"])[:14]:
        print(f"  {v['matches']:>4}m  {v['canonical'][:44]:44} <- {v['aliases']}")

    if ambiguous:
        print("\nAMBIGUOUS — left unassigned on purpose (Bat Index will read neutral for these):")
        for n, m, cs in sorted(ambiguous, key=lambda x: -x[1]):
            print(f"  {m:>4}m  {n:38} could be: {cs}")

    if folded_multi:
        print(f"\nREVIEW — folded into ONE ground despite >1 city label ({len(folded_multi)}). These are"
              f" island/suburb/rename variants; anything here that is really 2 grounds needs adding to"
              f" KNOWN_MULTI_GROUND:")
        for b, cs, m in sorted(folded_multi, key=lambda x: -x[2]):
            print(f"  {m:>4}m  {b[:40]:40} {cs}")

    still = defaultdict(list)
    for k, v in registry.items():
        still[base_name(v["canonical"])].append((v["city"], v["matches"]))
    multi = {b: c for b, c in still.items() if len(c) > 1}
    print(f"\nSTILL SPLIT across cities ({len(multi)}) — each should be genuinely different grounds:")
    for b, cs in sorted(multi.items(), key=lambda kv: -sum(m for _, m in kv[1])):
        parts = ", ".join("%s(%dm)" % (c or "unassigned", m) for c, m in sorted(cs, key=lambda x: -x[1]))
        print(f"  {b[:42]:42} {parts}")

if __name__ == "__main__":
    main()
