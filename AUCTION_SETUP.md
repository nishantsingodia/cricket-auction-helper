# Auction Setup — Exhaustive Runbook

How to stand up a new tournament + auction in this app, end to end, for **any**
tournament shape. Written from the code (engine, builders, routes, schema) so the
steps map 1:1 to what actually runs. Pair with `CLAUDE.md` (which holds the
short "don't break a live auction" rules — those are load-bearing, read them).

> **Golden rule before any number is shown:** surface every assumption and get
> the user to confirm it. Valuations drive real bidding — never silently default
> the format, the games-per-player, the EFPPM window, or the overseas model.

---

## 0. The pipeline (mental model)

```
 squad data ──► build-pool ──► auction_pool rows ──► valuation engine ──► prices
 (TS file or   (per-tournament  (player_id, ipl_team,  (EFPPM × expected   (val_expected,
  scraper)      builder)         squad_number, efppm,   matches × ceiling    efppm, risk_note
                                 is_overseas,risk_note)  → budget-balanced)   on the board)
```

- **Squad data** lives in `src/lib/squads/<tournament>.ts` (announced rosters,
  ordered XI-first) **or** is scraped live (IPL only).
- **Builder** `src/lib/squads/build-<tournament>-pool.ts` matches each squad name
  to a DB player (carrying career stats), creates statless rows for newcomers,
  and writes `auction_pool` rows. **`INSERT OR IGNORE` = additive** (never
  rewrites existing rows).
- **Engine** `src/lib/valuation/engine.ts` (`recalculateValuations`) computes
  EFPPM (Score1 × Score2), multiplies by expected matches + ceiling bonus,
  applies C/VC premium, then **budget-balances** so the top-N prices sum to the
  total money in the room.
- **Wiring**: `POST /api/pool/fetch {auctionId}` picks the builder by
  `auctions.tournament_name`, builds the pool, and **auto-runs valuation**.
  `POST /api/auction/start {tournamentId}` re-values only (safe).

**Key files**

| Concern | File |
|---|---|
| Squad data (per tournament) | `src/lib/squads/<t>.ts` |
| Pool builder (per tournament) | `src/lib/squads/build-<t>-pool.ts` |
| Valuation (all tournaments) | `src/lib/valuation/engine.ts` |
| Name matching (shared) | `src/lib/fuzzy-name-match.ts` |
| Pool build + auto-value | `src/app/api/pool/fetch/route.ts` |
| Re-value only | `src/app/api/auction/start/route.ts` |
| Manual price / risk note / role | `src/app/api/pool/update/route.ts` (PATCH) |
| Home page selector + create form | `src/app/page.tsx` |
| Live board (renders risk_note) | `src/app/auction/[id]/page.tsx` |
| Data ingest | `data/etl_cricsheet.py`, `data/refresh.sh` |

---

## 1. Classify the tournament (pick the archetype)

The whole setup is driven by which of these the tournament is. Identify it first.

| Archetype | Example | Squads | Games/player | Overseas cap | Knockouts |
|---|---|---|---|---|---|
| **A. Auto-scraped franchise** | IPL | scraped from iplt20.com | flat (league) | n/a (squads pre-set) | ignored (flat) |
| **B. Announced franchise + cap** | MLC | hand-curated TS file | flat (league) | **yes — max-N in XI** | small tier bonus optional |
| **C. Nation tournament / WC** | Women's T20 WC | hand-curated TS file | group + tiered knockout | n/a | **tier-weighted** |
| **D. Bilateral series** | AUS v BAN T20I | hand-curated TS file | = #matches in series | n/a | none |

The differences that matter cascade from this choice: **expected-matches model**,
**EFPPM league buckets**, **overseas handling**, and **venue model**.

---

## 2. Assumptions to clarify BEFORE building

Walk the user through these. Bold = must confirm, never default silently.

### 2.1 Universal (every tournament)
- **Exact edition & format** — confirm T20 vs ODI vs Test, men vs women, the year.
  The DB only holds **T20-family** data (`format` ∈ `IPL`/`T20`/`WPL`/`MLC`;
  women & men both under `T20`, split by `players.gender`). If it's not T20, stop —
  data won't support it.
- **Which teams/nations** are in scope.
- **Squad source**: official announced rosters vs top-N by fantasy points vs scrape.
- **XI source**: curated probable XIs (preferred — drives expected matches) vs
  auto-order by EFPPM.
- **Auction config**: #friends, purse/friend, players/friend, #captains, #vice-captains.
  - `topN = numFriends × playersPerFriend` = how many players get real prices
    (rest go to base ₹1). Fewer friends w/ bigger purses → higher marquee prices.

### 2.2 Per-archetype assumptions

**A — Auto-scraped franchise (IPL)**
- Confirm the scrape source is current (squads change at the mini-auction).
- Expected matches = flat league model (`getExpectedMatches`): squad 1–12 → 14,
  13–15 → 4, 16+ → 0. Confirm the league has ~14 games/team.
- Venue model **on** (IPL has a hardcoded 2026 schedule — see §4.3).

**B — Announced franchise + overseas cap (MLC)**
- **Overseas cap**: how many overseas can play in the XI (MLC = 6 of 11)? This is
  enforced by **ordering** (see §5.4), not a runtime rule.
- **"Domestic" definition**: is it nationality or a roster designation? (MLC =
  *drafted/US-resident designation*, NOT birth country — a Pakistani who's US-resident
  is domestic.) Get the official designation, don't infer from country.
- **Games/team** in the league (MLC = 10) and whether to add a playoff bonus.
- **Bench weightage** (see §5.5) — how fast does value fall outside the XI?
- **Availability** — franchise leagues overlap international windows; run the
  availability agent (§3.3). Replacement/cover chains matter (see COVER tag §5.3).
- EFPPM: which leagues are the "primary" buckets (MLC uses MLC-2025/2024, not IPL)
  and the quality filter (`'MLC','IPL'`).

**C — Nation tournament / World Cup (Women's WC)**
- **Group games per team** (WC = 5) + **knockout expectation by strength tier**
  (title contenders play semis/final → more games). Set tiers A/B/C.
- No overseas cap (national teams).
- **Opponent-quality filter** for EFPPM (e.g. top-8 nations) and which leagues
  count as quality (WPL counts for women).
- Venue model usually **off** (sparse data at neutral grounds — women's @ England
  was skipped).
- Squad newcomers (uncapped youngsters) will be statless → price near baseline; OK.

**D — Bilateral series (AUS v BAN T20I)**
- **#matches in the series** = expected matches for the XI (e.g. 3-match series → 3).
  Bench/squad players → 0–1.
- 2 teams only; no overseas cap, no knockouts.
- EFPPM from recent T20Is between/again these nations + recent franchise form;
  short recency window (form is everything in a 3-match series).
- Venue: single host country — only worth modelling if you hold venue data; usually off.
- Tiny sample → **expect sparse-data noise**; lean on manual caps (§7.4).

### 2.3 EFPPM assumptions (always confirm — see §4)
- **Recency windows**: last-10 (24mo), all-quality (30mo) — adjust for short tours.
- **Primary-league buckets**: which league's last-2-seasons feed Score1 (`leagueFmt`).
- **Quality filter**: which formats/opponents count (`qualityList`, top-8 nations).
- **Baseline** (20) for no-data players.
- **Sparse-data risk**: few-but-hot players over-price (missing buckets *redistribute*
  weight onto the few matches, not toward baseline). Decide: manual caps (default)
  vs engine shrinkage (§4.5).

### 2.4 Expected-matches & bench assumptions (see §5)
- Games for an XI starter; games for bench tiers; any availability haircuts.

### 2.5 Venue assumptions (see §4.3)
- Only enable if (a) you have a fixture list and (b) enough per-venue data.

---

## 3. Research agents (run these as a Workflow when data isn't in a clean source)

For announced-squad tournaments (B/C/D), the squads, XIs, designations and
availability often aren't in one place. Fan out subagents (one per team / per
player), each returning **structured output**, then synthesize. Patterns we use:

### 3.1 Likely-XI agent (archetypes B/C/D)
One agent per team. Input: current/known roster. Output (schema): the **expected
XI in batting order** + bench, each player `{name, role, overseas, avail}`, plus
`notes`/`sources`. Constraints in the prompt: e.g. "XI must be ≤6 overseas + ≥5
domestic". **Prefer actual XIs from matches already played** once the tournament
starts (gold source) over projections. Add an **adversarial verify** stage that
re-checks the XI is legal and matches real scorecards.

### 3.2 Designation / overseas agent (archetype B)
One agent per team. Resolves the **official overseas/domestic designation** (draft
status, not nationality) and flags squad-cap violations (e.g. >9 overseas signed →
which are non-registered overflow). This is what stops the "Pakistani-born =
overseas" mistakes.

### 3.3 Availability agent (B/C/D) — go DEEP, write narrative notes
One agent per at-risk player **and per replacement/cover player**. For each,
return a **rich panel note** (not 3 words): the exact series + dates, who they
replace or who covers for them, when they join/leave, realistic games, confidence,
sources. Capture **both directions** of a replacement chain:
- Star away on national duty → `LATE` (misses opener, joins later, ~8 games).
- Stand-in signed to cover them → `COVER` (plays only until the star arrives, ~2 games).
- Permanent replacement for an out player → full games, but note explains "in for X".
Add a **sweep agent** over the full overseas roster to catch missed international
clashes in the tournament window.

> Workflow shape that works well: `pipeline(teams, researchXI, verifyXI)` for §3.1,
> and `parallel(players → deepResearch)` + one sweep agent for §3.3. Schemas force
> clean structured returns; synthesize into the squad TS file yourself.

---

## 4. EFPPM model (`engine.ts`) — deep dive

EFPPM = **Score1 (recency-weighted base) × Score2 (venue/conditions factor)**.

### 4.1 Score1 — recency-weighted base (`computeScore1`)
Four buckets, weighted, **missing buckets redistribute proportionally**, baseline 20:

| Bucket | Weight | Definition |
|---|---|---|
| A | 40% | Last 10 "quality" T20s (24 months) |
| B | 30% | Primary league, **2025** season |
| C | 10% | Primary league, **2024** season |
| D | 20% | All "quality" T20s (30 months) |

- **"Quality"** = `format IN (qualityList)` **OR** (`format='T20'` AND opponent ∈
  top-8 nations). Tunables per tournament:
  - `leagueFmt` — primary league for B/C (`'IPL'` default, `'MLC'` for MLC).
  - `qualityList` — `('IPL','WPL')` (IPL/women) or `('MLC','IPL')` (MLC).
  - `TOP_8_NATIONS` — opponent-quality gate for T20I form.
- **Redistribution caveat (important):** if B/C are empty (player has no primary-league
  history), their weight is reassigned to A/D — so a newcomer with 5 hot matches
  gets ~that average, **not** diluted toward baseline. This is the sparse-data trap (§4.5).
- **Baseline 20** only fires when *no* bucket has data.

### 4.2 To retune Score1 for a new tournament
In `recalculateValuations`, the `isMLC`/`isWomensWC` flags set `leagueFmt` and
`qualityList`, and the B/C bucket date filters. Add a new flag + branch for a new
archetype; keep weights unless the user wants a different recency mix.

### 4.3 Score2 — venue/conditions factor (`computeConditionsFactor`)
- Classifies venues `bat_road / balanced / bowl_friendly` from historical FP,
  then weights each player's per-venue FP across the **team's actual fixture list**.
- Needs (a) a hardcoded schedule (`getTeamSchedules` — currently **IPL 2026 only**)
  and (b) ≥5 matches/player/venue to blend (else falls back to overall → factor 1.0).
- **Women's/MLC: effectively 1.0** (no schedule wired) → EFPPM = Score1.
- Enable for a new tournament only if you add its fixture list **and** have venue data.

### 4.4 Ceiling bonus (explosiveness)
`ceilingBonus = 1 + 0.15·min(cnt/25,1)·((top10%avg − EFPPM)/EFPPM)`. Rewards players
with a high ceiling (big top-10% scores) and enough sample. Applied to season value.

### 4.5 Sparse-data over-pricing (known, unsolved)
Few-but-hot players inflate (e.g. 5 T20s incl. one 187 → EFPPM 96 → priced as a
marquee). The model has **no sample-size shrinkage**; this hole exists in IPL too
but rarely bites (deep histories). **Default fix = per-player manual cap** (§7.4).
The engine fix (Bayesian shrink toward baseline by quality-match count) was
*declined* by the user — don't add it unprompted; cap individuals instead.

---

## 5. Expected matches & bench weightage — per archetype

`seasonValue = EFPPM × expectedMatches × ceilingBonus`. Expected matches is the
biggest lever and is **positional** (driven by `squad_number`, i.e. squad order).

> **Lineup size = 11 everywhere EXCEPT IPL.** IPL fields **12** (the Impact Player
> rule lets a 12th player be subbed in) — that's why IPL's full-games band runs
> 1–12. MLC, Women's WC and bilateral have no Impact Player, so the lineup is a
> standard **XI of 11** (band 1–11). This boundary governs both the "XI vs bench"
> split below **and** the playing-XI builder
> (`api/teams/[teamId]/playing-xi`, `lineupSize = format==='IPL' ? 12 : 11`).

### 5.1 IPL (`getExpectedMatches`)
`1–12 → 14`, `13–15 → 4`, `16+ → 0`. (XI + impact sub play the full league.)

### 5.2 Women's WC (`getWomensExpectedMatches`)
XI (1–11) by strength tier: **A 6.5 / B 5.3 / C 5.0** (group + expected knockouts);
bench (12–15) → **1.0**. Tier comes from `WC_TEAM_TIERS`.

### 5.3 MLC (`mlcExpectedMatches`) — positional + availability override
- **Availability tag overrides position** (it already encodes games played):
  `OUT 0 · COVER 2 · HALF 5 · LATE 8 · MID 6 · DOUBT 7 · BACK 8`.
- Else by position: **XI (1–11) → 10**, **pos 12 → 4**, **13–14 → 2.5**, **15+ → 1**
  (the user-chosen "heavier rotation" — surplus overseas keep some value since MLC
  rotates internationals).
- **COVER** is the inverse of LATE: a stand-in who plays only until the star they
  cover arrives (e.g. Siddle covering Hardie/Bartlett) → ~2 games + a note.

### 5.4 Overseas cap = ordering, not a runtime rule (archetype B)
There is **no engine check** for overseas-in-XI. You enforce the cap by **ordering
the squad file**: put exactly the allowed overseas (MLC = 6) + the rest domestic in
positions **1–11**; push surplus overseas to **12+** where positional games (and
thus value) fall. This mirrors how IPL benches surplus foreigners. Verify on the
board: `SUM(is_overseas) WHERE squad_number ≤ 11` must equal the cap for every team.

### 5.5 Bench weightage — the dial to confirm with the user
How fast does value drop outside the XI? Options we've used:
- **Strict (IPL-like):** pos 12 → 4, 13–15 → 4, 16+ → 0 (binary in/out).
- **Heavier rotation (MLC):** 12 → 4, 13–14 → 2.5, 15+ → 1 (surplus keep some value).
- **WC:** flat bench 1.0 (settled XIs, no rotation).
Pick based on how much the league actually rotates. Always **list the numbers and ask.**

### 5.6 Adding a new expected-matches model
Add a `get<Tournament>ExpectedMatches(squadNumber, …)` helper + a branch in
`recalculateValuations` (next to the `isMLC`/`isWomensWC` selection). Keep it
positional so squad ordering remains the single source of truth.

---

## 6. Wire a new tournament (code touchpoints)

1. **Squad file** `src/lib/squads/<t>.ts`: teams with `{name, short, color,
   strengthTier?}` and `players[]` ordered **XI (1–11) then bench**, each
   `{name, role, overseas?, avail?, note?}`. Export a `<T>_NAME` constant and any
   `*_TEAM_TIERS`. Add `NAME_ALIASES` for DB-spelling mismatches — **keys must be
   `normName`-stripped** (lowercase, no hyphens/dots: `"lhuandre pretorius"`, not
   `"Lhuan-dre Pretorius"`), values = exact DB name.
2. **Builder** `build-<t>-pool.ts`: 2-pass match (in-league stats, then broad
   T20/IPL), create statless newcomers, write `auction_pool`. For franchise leagues,
   **stamp `is_overseas`** from the squad file (DB's flag reflects the wrong
   context) and write `risk_note` from your note helper. **Match aliases EXACTLY
   before fuzzy** (the shared matcher's surname-only fallback can grab a same-surname
   different-initial player in an earlier pool — see `build-mlc-pool.ts` `matchPlayer`).
3. **Engine** `engine.ts`: add `is<T>` detection, set `leagueFmt`/`qualityList`,
   add the expected-matches branch.
4. **Route** `api/pool/fetch/route.ts`: add a branch on `tournament_name` →
   create the tournament row if missing → call your builder → `initializeValuations`.
5. **Home page** `page.tsx`: add to the `TOURNAMENTS` array (id = the
   `tournament_name`, label, note).
6. **Data** (if the league isn't ingested): add format detection in
   `data/etl_cricsheet.py` + the cricsheet folder, run `python3 data/etl_cricsheet.py`
   (skips already-ingested match_ids; preserves player IDs).

---

## 7. Create & verify an auction (mechanical)

1. **Create** (home page form): name, tournament, #friends, purse/friend,
   players/friend, #C/#VC, friend names (one `isMe`). Writes `auctions` +
   `auction_participants`.
2. **Fetch pool** → `POST /api/pool/fetch {auctionId}` (additive `INSERT OR IGNORE`;
   **auto-runs valuation** — prices are populated in the same call). To add teams to
   a live auction: pass `{teamsFilter:["X","Y"]}`.
3. **Re-value** (only after a manual change like lineup/tier edits) →
   `POST /api/auction/start {tournamentId}`. Writes only `efppm`/`val_*`, never
   sold rows/purses → safe.
4. **Manual price caps & risk notes** → `PATCH /api/pool/update {poolId,
   val_expected?, risk_note?, role?}`. `val_expected` sets `price_manual=1` so
   re-value preserves it (use for the sparse-data outliers, §4.5). `risk_note` shows
   as a ⚠ tooltip on the board + full text in the player modal (no length limit —
   write the full story).
5. **Verify** ("everything in line"):
   - Config + participant purses match intent.
   - Pool count + team count (e.g. 108 / 6 teams).
   - **Overseas-in-XI per team = cap** (archetype B): `SUM(is_overseas) WHERE
     squad_number ≤ 11` = 6 for MLC.
   - Lineups match intended/previous (0 `squad_number` diffs if carried over).
   - Top-N prices sum ≈ total money (`numFriends × purse`).
   - Removed players absent, new signings matched (check `unmatched` from fetch).
   - Status `SETUP`, ready to bid.

---

## 8. Live-auction safety (do NOT break it) — see CLAUDE.md

- **Never `DELETE`/rebuild `auction_pool` or run ETL on an auction with sales.**
  Purses live on `auction_participants` and aren't reset by a rebuild → wiping sold
  rows over-charges silently. Rebuild only when `status=SETUP` and 0 sold.
- **Re-valuing is safe** (`/api/auction/start`). Pool rebuild is not.
- **Back up first**: `cp db/cricket-auction.db db/cricket-auction.db.bak-<reason>`.
- **Test-cleanup by exact id only** — never `DELETE … WHERE tournament_name='X'`
  (the user may have a real auction on the same tournament).
- A rebuild re-matches by `cricsheet_id`/(name,country) and **preserves player IDs**;
  statless newcomers get re-created (minor orphan rows) — prefer **direct
  `UPDATE`** for tweaks over repeated full rebuilds.

---

## 9. Quick reference

**Tournament-type → settings**

| | IPL (A) | MLC (B) | Women's WC (C) | Bilateral (D) |
|---|---|---|---|---|
| Squads | scraped | TS file | TS file | TS file |
| `leagueFmt` (B/C buckets) | IPL | MLC | IPL* | IPL* |
| `qualityList` | IPL,WPL | MLC,IPL | IPL,WPL | IPL + recent T20I |
| Expected XI games | 14 | 10 | 6.5/5.3/5.0 | = #matches |
| Bench | 13-15→4 | 12→4,13-14→2.5,15+→1 | 1.0 | 0–1 |
| Overseas cap | n/a | 6 in XI (ordering) | n/a | n/a |
| Venue model | on | off | off | off |
| Availability | rare | **deep agent** | duty clashes | **deep agent** |

\* redistributes (empty league buckets reweight onto A/D).

**Availability tags (MLC `Avail`) → games**

`OUT 0 · COVER 2 · HALF 5 · MID 6 · DOUBT 7 · LATE 8 · BACK 8 · (none) 10`

**Pricing knobs**: `topN = friends × players/friend` get real prices; C slots
(`friends × #captains`) ×1.8, VC slots ×1.35 (ranked on full-pool EFPPM, sold
consumes its slot); normalize over **remaining** money/slots; bottom 10% + outside
top-N → ₹1.
