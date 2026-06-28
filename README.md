# Cricket Auction Helper

A self-hosted **live auction room** for the fantasy-cricket draft my friends run every tournament — with a data-driven player valuation engine underneath it, so bidding starts from real fair-value estimates instead of vibes.

> **Live demo:** not currently hosted. It runs locally against a Cricsheet-derived SQLite database (the engine needs ball-by-ball history that I don't ship in the repo). See [Run it locally](#run-it-locally).

---

## Why I built it

My friends and I don't do this once a season — we run a fresh auction almost **every month**, across whatever's on: IPL, the Women's T20 World Cup, MLC, a bilateral series. And every single time we hit the same wall: *who's even in the squad? who'll actually make the XI? and what on earth is anyone worth?* Nobody had a real read on a player's recent form, how they go at the venues on the actual schedule, or how they've done against quality opposition — so the early lots went for silly money and the marquee names we wanted sailed past our remaining purse. We were bidding on vibes.

I wanted a board that runs the auction live, tracks every purse to the rupee, and puts a *defensible, data-backed price* next to each name — so the table argues strategy, not arithmetic. It's a personal-scale tool, but I built the valuation model the way I'd scope a real pricing feature: assumptions surfaced explicitly, every number traceable back to ball-by-ball data.

## What it does

- **Runs a live auction.** A single shared board lists the pool; you mark each player sold to a friend at the hammer price. Purses debit in real time, with guardrails for insufficient funds and per-friend squad limits, plus a one-tap **undo** to reverse a misclick (and refund the purse). Quick-sell, unsold, and re-list flows are all wired.
- **Prices every player before the hammer falls — properly.** This is the heart of the app. For each player it builds an **Expected Fantasy Points Per Match (EFPPM)** projection from real ball-by-ball history, then turns that into a budget-balanced price. EFPPM is *not* a season average — it's a **recency-weighted blend of four form windows** (last-10 quality matches at 40%, the league's most recent season at 30%, the season before at 10%, and a 2.5-year quality baseline at 20%), where an empty window redistributes its weight instead of dragging a returning or new player toward a default. That base is then **scaled by venue conditions**: every ground is data-classified as batting / bowling / balanced, and the player's per-venue record is weighted across their team's *actual upcoming fixture list*, so a road-heavy schedule prices a batter up. Finally EFPPM is multiplied by **expected matches** (how many games they'll likely feature in — Impact-Sub aware) and a **ceiling / explosiveness bonus** (match-winners with high top-10% scores earn a premium), then normalised so the priced squad sums to the exact money in the room.
- **The model adapts to the tournament — including bilaterals.** For franchise leagues (IPL, MLC) it runs the full venue-aware, ~14-game model. For international tournaments and **bilateral-fed pools** (the Women's T20 World Cup, T20I-based squads) it *drops* the franchise-venue factor — there isn't enough trustworthy per-venue data — and shifts which competitions count as "quality" form (WPL and top-8-nation T20Is in place of IPL), plus a strength-tiered expected-matches model instead of a flat league season. Same engine, different archetype.
- **Supports multiple tournament shapes.** IPL (franchise squads scraped from the official site), the Women's T20 World Cup, and Major League Cricket are each modelled as a distinct *archetype* — they differ in expected games per player, which leagues count as quality form, and how overseas slots are handled.
- **Captain / vice-captain economics.** The pool is configured with C and VC slots; the genuinely top-ranked players carry a captaincy premium in their price, reflecting the points multiplier they'll earn.
- **Watchlist, player detail, and an AI advisor.** Tag targets, drill into a player's career and per-season splits, and ask a streaming Claude-backed advisor bid/skip questions in the context of the live board (purses, EFPPM, who's left).
- **Leaderboard + scoring.** Once the tournament starts, owners accrue their players' real fantasy points; the app tallies standings.

## How it's built

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM over `better-sqlite3` (local SQLite, WAL mode) · Tailwind v4 with shadcn / Base UI components · dnd-kit · Zustand · Recharts · Cheerio (scraping) · Anthropic SDK (advisor). The data pipeline is a small set of Python scripts that ingest Cricsheet ball-by-ball match files and compute Dream11-style fantasy points per performance.

A few pieces I'm happy with:

- **A two-score valuation engine (`src/lib/valuation/engine.ts`).** Each player's *Expected Fantasy Points Per Match* (EFPPM) is `Score1 × Score2`. **Score1** is a recency-weighted blend of four form buckets (last-10 quality matches, the primary league's last two seasons, and a longer quality window) — and crucially, when a bucket is empty its weight *redistributes proportionally* rather than dragging the estimate toward a baseline, so a newcomer with a small hot sample isn't unfairly diluted. **Score2** is a venue-conditions factor that weights a player's per-venue history across their team's *actual* fixture list, classifying grounds as batting/bowling/balanced from historical scoring and blending venue form with overall form by sample size. EFPPM then multiplies expected matches and a ceiling (explosiveness) bonus.

- **Budget-balanced pricing that stays honest mid-auction.** Expected prices are normalised so the priced players' values sum to the money in the room — but normalisation runs over the *remaining* purse and *remaining* slots, recomputed after each sale, so prices don't silently inflate as money and lots get consumed. The captaincy premium is anchored to a player's rank in the *whole* pool: when a marquee captain sells, he *consumes* the C/VC slot rather than cascading the premium down to whoever is now top of the leftovers — a mid-tier player shouldn't get a captain's price just because the real ones are gone.

- **Tournament archetypes instead of hard-coded IPL.** The same engine drives IPL, the Women's WC, and MLC by switching the expected-matches model and quality-form filters per tournament: IPL uses a flat ~14-game league with an Impact-Player twelfth man; the Women's WC uses group games plus a *strength-tiered* knockout expectation; MLC enforces its six-overseas-in-XI cap purely through squad ordering (surplus overseas get benched into lower-value slots) rather than a runtime rule. Adding a tournament is a squad file plus a pool builder plus one engine branch.

- **Stable cross-project player identity.** Player matching is *registry-first*: announced squad names resolve to database players by a stable Cricsheet ID via a shared global registry, with fuzzy name-matching only as a fallback. The fuzzy matcher (`src/lib/fuzzy-name-match.ts`) and the player registry are deliberately kept in sync with my companion drafting and points-feed projects — one canonical identity across all three, so a married-name change or a transliteration quirk is fixed once, everywhere.

- **Operational safety rails for a live auction.** Purses live on the participant rows, not on the pool, which means rebuilding the pool mid-auction would leave money debited with no matching sale. The pool-fetch path is therefore strictly *additive* (`INSERT OR IGNORE`), re-valuing never touches sold rows or purses, and the working notes (`CLAUDE.md`, `AUCTION_SETUP.md`) document the don't-break-a-live-auction invariants — a habit from shipping things people actually depend on mid-event.

## Run it locally

```bash
npm install
npm run dev
# http://localhost:3000
```

The app reads a local SQLite database at `db/cricket-auction.db` (override with `DB_PATH`). That database is **not** committed — it's built by the Python ETL under `data/` from Cricsheet match archives (`data/refresh.sh` → download + ETL + venue seed). The AI advisor is optional and only activates if you set `ANTHROPIC_API_KEY` in `.env.local`.

## Honest limitations / scope

- **Personal-scale, single-room.** It's a self-hosted tool for one auction table at a time, driven by one operator marking sales on a shared screen — not a multi-tenant SaaS, no auth, no real-time multi-device bidding.
- **No live demo without the data.** The valuation engine depends on a Cricsheet-derived database I don't publish, so there's no zero-setup hosted instance.
- **No sample-size shrinkage in the engine (known gap).** A player with a few but explosive matches can over-price, because empty form buckets redistribute weight onto the matches that *do* exist. I chose to handle these with per-player manual price caps rather than baking Bayesian shrinkage into the model — a deliberate scope call, but a real edge.
- **Venue conditioning is IPL-only.** Score2 needs a hard-coded fixture list and enough per-venue history; for the Women's WC and MLC it effectively resolves to 1.0, so those valuations are pure form.
- **Scraping is brittle.** IPL squads are scraped from the official site and will break when the page markup changes; announced-squad tournaments are hand-curated TypeScript files.
- **Rough edges from being a real working tool.** A few empty stub `.db` files and a stale data script linger in the tree, and there's the usual personal-project mix of committed code and local working notes.

---

**Nishant Singodia** — Director of Product · IIT Kharagpur · Mumbai
[GitHub](https://github.com/nishantsingodia) · [LinkedIn](https://linkedin.com/in/nishantsingodia) · [nishantsingodia@gmail.com](mailto:nishantsingodia@gmail.com)
