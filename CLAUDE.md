# Cricket Auction Helper — Working Notes & Setup Runbook

Next.js + better-sqlite3 + Drizzle fantasy-cricket auction app. Friends bid on
real players; each owner accrues the players' real-tournament fantasy points
(NO playing-XI to field, NO role quotas, NO max-per-team — pure points
accumulation).

- **Real DB:** `db/cricket-auction.db` (other root `*.db` files are empty stubs).
- **Dev:** `npm run dev` → http://localhost:3000
- **Data pipeline:** `data/refresh.sh` → `download_cricsheet.py` + `etl_cricsheet.py` + `seed_venues.py`
  - ⚠️ `data/wc_fps_to_csv.py` is a **STALE copy** — the live points generator now lives in the
    standalone **wwc-points-bot** repo (runs in CI, writes the Google Sheet). Delete or re-sync it;
    don't edit this copy expecting it to take effect.
- **Player identity:** `src/lib/registry/players.json` is the shared global identity (cricsheet_id-anchored)
  used by the pool builders (registry-first). It is PRODUCED by `wwc-points-bot/build_registry.py`. To
  refresh, run **`npm run sync-registry`** (pulls the canonical file straight from the wwc-points-bot
  GitHub repo) — no more manual `cp` from a local checkout (which silently went stale).
- **Fuzzy matcher:** `src/lib/fuzzy-name-match.ts` is now a thin re-export shim of the shared
  **`cricket-identity`** package (`github:nishantsingodia/cricket-identity`), shared with wwc-draft. Edit the
  algorithm ONLY in that repo, bump its version, then `npm update cricket-identity` here. Do NOT paste the
  algorithm back. (`src/lib/registry/index.ts`'s `regNorm` is a SEPARATE, deliberately-different
  normalizer — leave it alone.)
- **Raw data:** `data/raw/{ipl,t20i,wpl}` (cricsheet JSON, by match id)
- **Squad data:** `src/lib/squads/*.ts` · **Valuation:** `src/lib/valuation/engine.ts`

---

## ⛔ CRITICAL — never break a live auction
- **NEVER `DELETE`/rebuild `auction_pool` or run the ETL on an auction that has
  sales.** Purses live on `auction_participants` and are NOT reset by a pool
  rebuild → wiping sold rows leaves money debited with no matching sale (silent
  over-charge). Adding teams/players to a live auction must be **additive**
  (`INSERT OR IGNORE`, the `teamsFilter` path in `/api/pool/fetch`).
- **Re-valuing is safe** (`/api/auction/start` only writes `val_expected`/`efppm`,
  never sold rows or purses). Pool rebuild is NOT safe.
- **Always back up first:** `cp db/cricket-auction.db db/cricket-auction.db.bak-<reason>`
- **Reconcile a drifted purse:** `remaining_purse = purse − SUM(their sold_price)`.
- Before any pool/ETL op, check: `SELECT COUNT(*) FROM auction_pool WHERE auction_id=? AND status='SOLD'`.

---

## Setting up a NEW TOURNAMENT

1. **Clarify assumptions BEFORE building** (always surface, never silently default):
   - Which edition/format — confirm it's unambiguous (e.g. T20 WC vs ODI WC).
   - Verify **data supports the format** (we only hold T20 data; women's & men's
     both stored under `format='T20'`, distinguished by `players.gender`).
   - Which teams/nations to include.
   - Squad source: official announced rosters vs top-N by fantasy points.
   - Lineups: curated probable XIs vs auto-order by EFPPM.
   - Expected-matches model: tournament-specific game counts + strength tiers
     (NOT the IPL 14-game default — see `getWomensExpectedMatches`).
   - EFPPM scope: opponent-quality filter (top-8 nations), recency window
     (24/30 months), and which leagues count as "quality" (e.g. WPL).
   - Venue model: only worth it if there's enough data (women's @ England
     grounds was too sparse → skipped).

2. **⚠️ REFRESH MATCH DATA FIRST — MANDATORY, not optional (this step gets skipped; don't).**
   EVERYTHING downstream reads `match_performances`: the player-modal **"Recent Matches"** tab,
   `career_stats`, EFPPM/valuations, and the venue model. If the dump is stale, the new tour is
   valued on old form AND "Recent Matches" shows nothing recent — the exact "why aren't recent
   matches updating?" symptom. Do this BEFORE adding squads / building any pool.
   - **Check freshness first:** `SELECT format, MAX(match_date) FROM match_performances GROUP BY format;`
   - **Incremental ingest (no full re-download):** download the cricsheet zip to a temp dir, copy
     only **new** match files (filename = match id) into `data/raw/<folder>`, then
     `python3 data/etl_cricsheet.py` (skips already-ingested ids; rebuilds career/venue/opposition
     stats globally). Archives: `t20s_json.zip`, `ipl_json.zip`, `wpl_json.zip`, `mlc_json.zip`.
   - Matches by `cricsheet_id` then `(name, country)` → **player IDs preserved** (safe for existing
     auctions' references). Touches ONLY match/stats tables — never `auction_pool`.
   - **🚫 NEVER run the ETL while an auction is LIVE** (app open on :3000 / SOLD rows present /
     mid-bidding). It's the "global ETL recompute" the id=7 disaster warns about
     ([[feedback_no_live_auction_pool_rebuild]]): concurrent writes with the running app can
     lock/corrupt, and it shifts the valuation basis mid-auction. Gate check:
     `SELECT auction_id, COUNT(*) FROM auction_pool WHERE status='SOLD' GROUP BY auction_id;`
     If anything is live/sold → **back up, then DEFER the refresh until the session ends** (or work
     on a copy). This is why the refresh must happen at tour-SETUP time, before anyone bids.
   - WPL is tagged `format='WPL'` (distinct from T20I). To make a league count in valuation, add it
     to the quality filter in `engine.ts` (the `format IN (...)`).

3. **Add squad data** → `src/lib/squads/<tournament>.ts`:
   - Players ordered **XI (1–11, batting order) then bench (12–15)** — squad_number
     drives expected matches.
   - `strengthTier` (A/B/C) for strength-weighted expected matches.
   - `groupVenues`, tournament name constant, derived `*_TEAM_TIERS`.
   - **Name matching is now registry-FIRST.** The pool builders (`build-*-pool.ts`)
     resolve each announced name to a DB player by stable `cricsheet_id` via the shared
     global registry (`src/lib/registry/` — a copy of `wwc-points-bot/registry/players.json`,
     the SAME identity the points sheet & draft use), before any fuzzy logic. So a new tour
     is mostly auto-resolved. Per-builder `NAME_ALIASES` / `MLC_NAME_ALIASES` + `SEARCH_ALIASES`
     remain as a FALLBACK for players the registry doesn't cover yet.
   - To fix a genuinely-unlinkable name (e.g. Chamari Athapaththu = "AC Jayangani"), prefer
     adding it ONCE to `wwc-points-bot/registry/manual_aliases.json` (re-run `build_registry.py`,
     then `cp wwc-points-bot/registry/players.json src/lib/registry/`) so all three projects get
     it — rather than only the local alias maps.

4. **Verify** the pool builder's match rate; unmatched newcomers are created
   statless (fine — they price near baseline).

---

## Setting up a NEW AUCTION

1. **Create** (home page): name, #friends, purse/friend, players/friend, #C/#VC,
   select tournament. (Women's WC builds the pool from squad data; IPL scrapes.)
2. **Fetch pool** → `POST /api/pool/fetch {auctionId}` (additive). For a live
   auction adding teams: pass `{teamsFilter:["SCO","NED"]}`. **This now auto-runs
   valuation at the end** (both the women's-WC and IPL branches call
   `initializeValuations` before returning), so prices are populated in the same
   call — a fresh pool should never show ₹0 again.
3. **(Re-)compute prices** → `POST /api/auction/start {tournamentId}`. Only needed
   to RE-value after a manual change (e.g. lineup edits, C/VC tweaks). Not required
   right after a pool fetch anymore.
4. **Carry over lineups** from a previous auction of the same tournament, if the
   user customized XIs: copy `squad_number` per `player_id`
   (`UPDATE auction_pool ... SET squad_number = (SELECT ... FROM auction_pool a7 WHERE a7.auction_id=<prev> AND a7.player_id=...)`),
   then re-value.
5. **Verify "everything in line":**
   - Config + participant purses match intent.
   - Pool count + team count (e.g. 180 / 12 teams).
   - Lineups match the intended/previous auction (0 squad_number diffs).
   - Top-N prices (`N = friends × players/friend`) sum ≈ total money
     (`friends × purse`). Fewer friends w/ bigger purses → higher marquee prices.
   - Status `SETUP`, ready to bid.

---

## Valuation model (women's WC) — quick reference
`EFPPM = Score1` (venue factor = 1.0 for women). `seasonValue = EFPPM ×
expectedMatches × ceilingBonus`. Then C/VC premium, then budget-balanced price.
- **Expected matches:** XI = 6.5 (tier A) / 5.3 (B) / 5.0 (C); bench = 1.
- **EFPPM sources:** last-10 vs top-8 nations (24mo) + all-quality (30mo); IPL
  buckets are empty for women and redistributed; **WPL counts as quality**.
- **Budget normalization uses REMAINING money & slots** (not full pool) so prices
  don't inflate as players sell.
- **C/VC premium is anchored to full-pool EFPPM rank** — a sold marquee consumes
  its slot; the premium does NOT cascade to whoever is top of the leftovers.

---

## Valuation model (bilateral T20I series) — quick reference
For a short bilateral series (e.g. India vs England Men's T20 2026, 5 matches)
there is **no franchise league season** to anchor Score 1 on, so the IPL-style
`leagueFmt` buckets (IPL 2025 / 2024) do not apply. The archetype:

- **Score 1 (form):** drop the two league-season buckets and put their weight on
  the two T20-form buckets, **keeping recent-form heavier — 60% Last-10 quality T20
  + 40% all-quality-30mo** (baseline 20 for no-data). IPL form is NOT lost: IPL
  matches still count *inside* "quality" (quality = IPL/league OR a T20I vs a
  top-8 nation), we just stop double-weighting old IPL seasons. Implemented as a
  bilateral weight set in `computeScore1` (do not reuse the 40/30/10/20 set).
- **Expected matches:** XI (squad 1–11) = **5** (plays every game), bench (12+) =
  **2** (5-match bilaterals rotate / experiment in dead rubbers — bench is NOT 0).
- **Venue:** ON, but it needs care for non-IPL grounds — see the venue rules below.
  Net signal for English July grounds is **bowl-leaning** (Trent Bridge, Bristol,
  Durham bowl_friendly; Old Trafford & Southampton balanced; none bat_road).
- **Uncapped players:** use domestic/IPL form where it exists, else baseline 20.
- **C/VC premium + remaining-money budget normalization:** identical to the other
  tours.

### Venue classification — READ THIS before trusting venue numbers
The venue factor classifies each ground `bat_road / balanced / bowl_friendly`.
Three things that are easy to get wrong (all bit us on the India-England setup):
1. **Classify on Batting FP vs Bowling FP, NOT blended "Avg FP."** The signal is
   `AVG(batter+WK fantasy_points) ÷ AVG(bowler fantasy_points)` (>1.10 bat_road,
   ≥0.95 balanced, else bowl_friendly). A blended avg-FP-per-player number hides
   the bat/bowl character — a high avg can come from big *bowling* hauls.
2. **Consolidate cricsheet venue-name variants.** cricsheet renamed many grounds
   ~2021 (`Trent Bridge` → `Trent Bridge, Nottingham`, `The Rose Bowl` → `The Rose
   Bowl, Southampton`, `Riverside Ground` → `Riverside Ground, Chester-le-Street`,
   etc.). `classifyVenues` groups by raw `venue_name` + filters `match_date>=2020`,
   so it silently undercounts a famous ground to 2–5 matches. For bilateral grounds,
   canonicalize the name variants (merge both spellings) so the full men's history
   is used — Old Trafford/Trent Bridge/Southampton each have ~13–14 men's T20Is, not 3.
3. **Bifurcate men's vs women's.** These grounds host both, both stored under
   `format='T20'`, separated only by `players.gender`. Venue classification MUST
   filter `gender='male'` for a men's tour (`classifyVenues` already does) — women's
   T20Is at the same ground would otherwise pollute the bat/bowl ratio.
