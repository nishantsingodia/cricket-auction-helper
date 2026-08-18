import { sqlite, withTransaction } from "@/db";
import {
  WOMENS_T20_WC_2026_NAME,
  WC_TEAM_TIERS,
  XI_SIZE,
  type StrengthTier,
} from "@/lib/squads/womens-t20-wc-2026";
import { MLC_2026_NAME, mlcExpectedMatches } from "@/lib/squads/mlc-2026";
import {
  IND_VS_ENG_T20_2026_NAME,
  bilateralExpectedMatches,
} from "@/lib/squads/ind-vs-eng-t20-2026";
import {
  ENG_VS_PAK_TEST_2026_NAME,
  testExpectedMatches,
} from "../squads/eng-vs-pak-test-2026";
import {
  IRE_VS_WI_W_ODI_2026_NAME,
  odiExpectedMatches,
} from "@/lib/squads/ire-wi-w-odi-2026";
import {
  NZ_VS_WI_MEN_ODI_2026_NAME,
  mensOdiExpectedMatches,
} from "@/lib/squads/nz-wi-men-odi-2026";
import {
  THE_HUNDRED_MEN_2026_NAME,
  THE_HUNDRED_WOMEN_2026_NAME,
  HUNDRED_VENUES,
  HUNDRED_ROLE_NORM,
  hundredExpectedMatches,
  type Role as HundredRole,
} from "@/lib/squads/the-hundred-2026";
import {
  LPL_2026_NAME,
  lplExpectedMatchesFor,
} from "@/lib/squads/lpl-2026";
import {
  CPL_2026_NAME,
  cplExpectedMatchesFor,
} from "@/lib/squads/cpl-2026";

/**
 * IPL Auction Valuation Engine — 2-Score Model
 *
 * Score 1: Recency-weighted base EFPPM
 *   A (40%): Last 15 quality T20 matches
 *   B (30%): IPL 2025
 *   C (10%): IPL 2024
 *   D (20%): All quality T20 last 2.5yr
 *   Missing sources redistributed proportionally. Baseline 20.
 *
 * Score 2: Venue conditions factor (schedule-based)
 *   - Data-driven venue classification: bat_road / balanced / bowl_friendly
 *   - Per-player weighted FP across actual 14-match IPL schedule
 *   - Fallback: venue-specific → venue-type → overall (no adjustment)
 *
 * Expected matches (impact sub rule):
 *   Squad 1-12: 14, Squad 13-15: 4, Squad 16+: 0
 *
 * Budget-balanced pricing: top N players' prices sum to total auction money
 *   N = numFriends × playersPerFriend
 */

// Short code → full team name in match_performances
const TEAM_FULL_NAMES: Record<string, string> = {
  CSK: "Chennai Super Kings",
  MI: "Mumbai Indians",
  RCB: "Royal Challengers Bengaluru",
  KKR: "Kolkata Knight Riders",
  DC: "Delhi Capitals",
  SRH: "Sunrisers Hyderabad",
  RR: "Rajasthan Royals",
  PBKS: "Punjab Kings",
  GT: "Gujarat Titans",
  LSG: "Lucknow Super Giants",
};

const TOP_8_NATIONS = [
  "India", "Australia", "England", "South Africa",
  "New Zealand", "West Indies", "Pakistan", "Sri Lanka",
];

interface PoolPlayer {
  id: number;
  player_id: number;
  status: string;
  role: string;
  name: string;
  squad_number: number;
  ipl_team: string;
  price_manual: number;
  efppm: number;
  sold_price: number;
}

function getExpectedMatches(squadNumber: number): number {
  if (squadNumber >= 1 && squadNumber <= 12) return 14;
  if (squadNumber >= 13 && squadNumber <= 15) return 4;
  return 0;
}

// Women's T20 World Cup: 5 group games for everyone in the XI, plus a
// strength-weighted knockout expectation (SF = +1 game, final = +1).
//   Tier A (title contenders): ~6.5  (likely semi, decent final shot)
//   Tier B (mid):              ~5.3  (occasional semi)
//   Tier C (group exit):       ~5.0  (group stage only)
// Bench (squad 12–15): ~1 game — no Impact-sub rule in women's T20, XIs are
// settled, so bench cover only features in dead rubbers / injuries.
const WC_XI_MATCHES: Record<StrengthTier, number> = { A: 6.5, B: 5.3, C: 5.0 };
const WC_BENCH_MATCHES = 1.0;

function getWomensExpectedMatches(
  squadNumber: number,
  tier: StrengthTier
): number {
  if (squadNumber >= 1 && squadNumber <= XI_SIZE) return WC_XI_MATCHES[tier];
  return WC_BENCH_MATCHES;
}

// ==================== SCORE 1: Recency-Weighted Base EFPPM ====================

interface Score1Data {
  last15Avg: number;
  last15Count: number;
  ipl2025Avg: number;
  ipl2025Count: number;
  ipl2024Avg: number;
  ipl2024Count: number;
  t20_2_5yrAvg: number;
  t20_2_5yrCount: number;
}

// weights = [last15-quality, leagueSeason2025, leagueSeason2024, allQuality30mo].
// Default (IPL/MLC/women) = [0.40,0.30,0.10,0.20]. A bilateral series has NO league
// season, so it passes [0.60,0,0,0.40] — recent-form-heavy, season buckets dropped.
function computeScore1(
  data: Score1Data,
  weights: number[] = [0.40, 0.30, 0.10, 0.20]
): number {
  const sources: Array<{ weight: number; avg: number; hasData: boolean }> = [
    { weight: weights[0], avg: data.last15Avg, hasData: data.last15Count > 0 },
    { weight: weights[1], avg: data.ipl2025Avg, hasData: data.ipl2025Count > 0 },
    { weight: weights[2], avg: data.ipl2024Avg, hasData: data.ipl2024Count > 0 },
    { weight: weights[3], avg: data.t20_2_5yrAvg, hasData: data.t20_2_5yrCount > 0 },
  ];

  const available = sources.filter((s) => s.hasData && s.weight > 0);
  if (available.length === 0) return 20; // baseline for uncapped

  const totalWeight = available.reduce((s, v) => s + v.weight, 0);
  let score = 0;
  for (const s of available) {
    score += (s.weight / totalWeight) * s.avg;
  }
  return score;
}

// Red-ball shrinkage prior: the expected mean Test FP of a player in each role.
//
// This MUST be measured on Test data and cannot reuse the white-ball prior of 40. Test FP run 2-3x
// the T20 scale (two innings, +20 a wicket, no rate bonuses), so shrinking a Test average toward 40
// is not a regression to the mean — 40 sits near the 5th percentile, and it would penalise every
// player short of caps rather than stabilise them.
//
// Measured as the mean of PLAYER MEANS, not of all performances: the quantity being shrunk is one
// player's average, so the prior should describe how player averages are distributed. Pooling raw
// rows instead would weight the prior by games played (a 60-Test regular vs a debutant) and gives a
// materially different number. Players need >= TEST_PRIOR_MIN_TESTS in the window to contribute, so
// the prior is not itself built out of the small samples it exists to correct.
//
// ⚠️ players.role is inferred largely from white-ball data and files most red-ball spinners under
// AR (Sajid Khan, Jadeja, Santner, Harmer), which lifts the AR prior. Bounded in practice — the
// prior only carries real weight for thin samples, and none of the thin players here are ARs.
const TEST_PRIOR_MONTHS = 60;
const TEST_PRIOR_MIN_TESTS = 5;   // per player, to contribute to the prior
const TEST_PRIOR_MIN_PLAYERS = 10; // per role, else fall back to the pooled all-role prior
const TEST_PRIOR_FALLBACK: Record<string, number> = {
  BAT: 99.2, WK: 112.0, AR: 124.6, BOWL: 102.4,
};

async function computeTestRolePrior(): Promise<Record<string, number>> {
  const rows = (await sqlite
    .prepare(
      `SELECT role, AVG(pm) AS prior, COUNT(*) AS players FROM (
         SELECT p.role AS role, AVG(mp.fantasy_points) AS pm
           FROM match_performances mp
           JOIN players p ON p.id = mp.player_id
          WHERE mp.format = 'TEST'
            AND (p.gender = 'male' OR p.gender IS NULL)
            AND mp.match_date >= date('now', '-${TEST_PRIOR_MONTHS} months')
          GROUP BY p.id
         HAVING COUNT(*) >= ${TEST_PRIOR_MIN_TESTS}
       )
       GROUP BY role`
    )
    .all()) as Array<{ role: string | null; prior: number; players: number }>;

  const out: Record<string, number> = { ...TEST_PRIOR_FALLBACK };
  const pooled = rows.reduce((a, r) => a + r.prior * r.players, 0) /
    Math.max(1, rows.reduce((a, r) => a + r.players, 0));
  for (const r of rows) {
    if (!r.role) continue;
    out[r.role] = r.players >= TEST_PRIOR_MIN_PLAYERS ? r.prior : pooled;
  }
  return out;
}

function trimmedMean(xs: number[], p = 0.1): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * p);
  const core = s.length - 2 * k >= 1 ? s.slice(k, s.length - k) : s;
  return core.reduce((a, b) => a + b, 0) / core.length;
}

// The Hundred is scored on its own 100-ball scale, so non-Hundred form must be converted per role.
// This is a FORMAT-scale normalisation, not a venue adjustment — it survives the venue removal. It
// happens to read the Hundred's 8 grounds simply because that is where Hundred cricket is played.
const HUNDRED_NORM_MONTHS = 72; // measurement window (covers the full Hundred era; grows each yr)
const HUNDRED_NORM_MIN_N = 20; // per role & format: min performances to trust the computed factor
const HUNDRED_NORM_MIN_FACTOR = 0.6; // clamp band — guards against a data glitch
const HUNDRED_NORM_MAX_FACTOR = 1.15;

async function computeHundredRoleNorm(
  gender: "male" | "female"
): Promise<Record<HundredRole, number>> {
  const variants = HUNDRED_VENUES.flatMap((v) => v.variants);
  const ph = variants.map(() => "?").join(",");
  const rows = await sqlite
    .prepare(
      `SELECT mp.format AS fmt, p.role AS role, mp.fantasy_points AS fp
       FROM match_performances mp JOIN players p ON p.id = mp.player_id
       WHERE p.gender = ? AND mp.format IN ('HUN','T20')
         AND mp.match_date >= date('now', ?)
         AND mp.venue_name IN (${ph})`
    )
    .all(gender, `-${HUNDRED_NORM_MONTHS} months`, ...variants) as Array<{
    fmt: string;
    role: string;
    fp: number | null;
  }>;

  const bucket: Record<string, { HUN: number[]; T20: number[] }> = {};
  for (const r of rows) {
    if (r.fp == null) continue;
    (bucket[r.role] ??= { HUN: [], T20: [] });
    if (r.fmt === "HUN") bucket[r.role].HUN.push(r.fp);
    else bucket[r.role].T20.push(r.fp);
  }

  const out: Record<HundredRole, number> = { ...HUNDRED_ROLE_NORM };
  for (const role of ["BAT", "WK", "AR", "BOWL"] as HundredRole[]) {
    const b = bucket[role];
    if (!b || b.HUN.length < HUNDRED_NORM_MIN_N || b.T20.length < HUNDRED_NORM_MIN_N)
      continue; // too little data → keep the hardcoded fallback for this role
    const t20 = trimmedMean(b.T20);
    if (!(t20 > 0)) continue;
    const ratio = trimmedMean(b.HUN) / t20;
    out[role] = Math.max(
      HUNDRED_NORM_MIN_FACTOR,
      Math.min(HUNDRED_NORM_MAX_FACTOR, ratio)
    );
  }
  return out;
}

// ==================== MAIN VALUATION ====================

export async function recalculateValuations(
  tournamentId: number | string,
  auctionId?: number | string
) {
  // --- Auction config ---
  const auctionQuery = auctionId
    ? await sqlite
        .prepare(
          "SELECT purse_per_friend, num_friends, players_per_friend, num_captains, num_vice_captains, changes_allowed FROM auctions WHERE id = ?"
        )
        .get(auctionId)
    : await sqlite
        .prepare(
          "SELECT purse_per_friend, num_friends, players_per_friend, num_captains, num_vice_captains, changes_allowed FROM auctions WHERE tournament_id = ? LIMIT 1"
        )
        .get(tournamentId);
  const auctionConfig = auctionQuery as {
    purse_per_friend: number;
    num_friends: number;
    players_per_friend: number;
    num_captains: number;
    num_vice_captains: number;
    changes_allowed: number | null;
  } | undefined;

  if (!auctionConfig) return;

  // Detect tournament type — the Women's T20 WC uses a different
  // expected-matches model (WC fixtures, not the 14-game IPL league).
  const tournamentRow = await sqlite
    .prepare("SELECT name FROM tournaments WHERE id = ?")
    .get(tournamentId) as { name: string } | undefined;
  const isWomensWC = tournamentRow?.name === WOMENS_T20_WC_2026_NAME;
  const isMLC = tournamentRow?.name === MLC_2026_NAME;
  const isBilateral = tournamentRow?.name === IND_VS_ENG_T20_2026_NAME;
  const isHundredMen = tournamentRow?.name === THE_HUNDRED_MEN_2026_NAME;
  const isHundredWomen = tournamentRow?.name === THE_HUNDRED_WOMEN_2026_NAME;
  const isHundred = isHundredMen || isHundredWomen;
  // First ODI-format tour: a women's ODI bilateral. Scores purely on ODI form (no league season,
  // no T20 supplement), venue OFF (women's grounds are sparse → factor 1.0, same as women's WC).
  const isWomensOdi = tournamentRow?.name === IRE_VS_WI_W_ODI_2026_NAME;
  // Men's ODI bilateral: ODI form vs top-8 nations, venue ON (Caribbean grounds classified on
  // men's ODI data), 60/40 recency weights, XI=5/bench=2 expected matches.
  const isMensOdi = tournamentRow?.name === NZ_VS_WI_MEN_ODI_2026_NAME;
  // LPL 2026: standard 20-over franchise T20 → modelled like MLC. Own 'LPL' league bucket so
  // its games count; quality = LPL + IPL + top-8 T20Is; default 40/30/10/20 weights (LPL had no
  // 2025 edition, so the 2025 season bucket is empty and its weight redistributes — handled by
  // computeScore1). No scale-normalization / no shrinkage (that is Hundred-only). Venue ON: all
  // 2026 grounds read bowl_friendly on ingested LPL+SL-T20I history — see the isLpl venue block.
  const isLpl = tournamentRow?.name === LPL_2026_NAME;
  // CPL 2026: standard 20-over franchise T20, modelled like LPL/MLC but WITHOUT the LPL season
  // slide-back — CPL ran a real 2025 season (Aug–Sep) and a 2024 one, so the default calendar
  // 2025/2024 league-season buckets are genuinely populated and the DEFAULT 40/30/10/20 weights
  // apply. Own 'CPL' league bucket; quality = every marquee franchise T20 + top-8 T20Is; per-bucket
  // small-sample shrinkage ON (franchise league, same reasoning as LPL). Venue ON — the Caribbean
  // is a bowler's league: 4 of the 8 grounds read bowl_friendly and none read bat_road.
  const isCpl = tournamentRow?.name === CPL_2026_NAME;
  // ENG v PAK 2026: the first RED-BALL tour. Scored purely on Test form ('TEST'), which is a
  // different points scale entirely (2 innings, +20 a wicket, no rate bonuses) — so nothing
  // white-ball may leak into it, in either direction. No league season, so the bilateral
  // recency weights apply. First-class ('FC') is ingested but deliberately absent from the
  // quality clause: it is display-only form, because Pakistan's domestic red-ball competition
  // is not published by cricsheet and counting FC would tilt the pool toward England's fringe.
  const isTest = tournamentRow?.name === ENG_VS_PAK_TEST_2026_NAME;
  // For MLC, the "primary league season" buckets are MLC (not IPL), and the quality pool is
  // MLC + IPL + T20I (vs WPL for the women's path). A bilateral T20I series has NO league
  // season: Score 1 drops the season buckets, weights Last-10 60% + all-quality-30mo 40%.
  // The Hundred is a franchise league scored on its OWN scale ('HUN'): league season = HUN
  // 2025/2024; quality = HUN + T20/IPL/MLC (men) or HUN + WPL + women's-T20 (women); the
  // non-Hundred proxy form is normalized to the Hundred scale per role (normMult below).
  // LPL: venue ON — all 2026 grounds read bowl_friendly on LPL+SL-T20I history (subcontinent);
  // venueClassification + per-team schedule overridden in the isLpl block below.
  const leagueFmt = isHundred ? "HUN" : isMLC ? "MLC" : isLpl ? "LPL" : isCpl ? "CPL" : "IPL";
  const qualityList = isHundredMen
    // Marquee franchise leagues only — Vitality Blast ('BLAST') is EXCLUDED: it's domestic
    // county T20 (a tier below), and at 1,557 matches it's the largest bucket, so counting it
    // would let county form dominate the last-15 window — the opposite of reducing single-tour bias.
    ? "'HUN','T20','IPL','MLC','BBL','PSL','SA20','ILT20','CPL','LPL'"
    : isHundredWomen
    // WBBL now ingested (women's Big Bash, format 'WBBL') → counts as marquee franchise form
    // alongside The Hundred, WPL and all women's T20.
    ? "'HUN','WPL','T20','WBBL'"
    : isLpl
    // Franchise-T20 league: LPL squads are full of journeymen whose form lives in OTHER franchise
    // leagues, not LPL/IPL. Count ALL marquee franchise leagues as quality (incl. HUN — The Hundred,
    // mirroring what the Hundred build does in reverse with 'LPL') — else a BBL regular like Sam
    // Harper (all BBL/PSL) sits at baseline 20, and 29/100 of the pool did. Only BLAST (county
    // T20, a tier below — would swamp the sample) is excluded.
    ? "'LPL','IPL','BBL','PSL','CPL','SA20','ILT20','MLC','HUN'"
    : isCpl
    // Same reasoning as LPL, and it bites harder here: a CPL squad is 5 overseas players per team
    // whose form lives entirely OUTSIDE the Caribbean (Moeen/Hales in HUN+BLAST, Shadab/Naseem in
    // PSL, de Kock in SA20/ILT20, Gurbaz/Nabi in everything). Counting only CPL+IPL would park most
    // of the marquee overseas talent at baseline. BLAST stays excluded (county tier, would swamp).
    ? "'CPL','IPL','BBL','PSL','LPL','SA20','ILT20','MLC','HUN'"
    : isMLC || isBilateral
    ? "'MLC','IPL'"
    : "'IPL','WPL'";
  // Bilateral (T20I) AND both ODI archetypes have no league season → recent-form-heavy.
  // LPL: no 2025 edition, and its last real seasons (2024/2023) are ~1–2 yrs old, so lean recency —
  // 45% last-15 form, 20% most-recent LPL season (2024), 10% prior season (2023), 25% all-quality.
  const score1Weights =
    isBilateral || isWomensOdi || isMensOdi || isTest
      ? [0.60, 0, 0, 0.40]
      : isLpl
      ? [0.45, 0.20, 0.10, 0.25]
      : undefined;

  // "League season" bucket boundaries. Default = calendar 2025 (recent) / 2024 (prior). LPL ran NO
  // 2025 edition, so the two season buckets SLIDE BACK to the two most recent ACTUAL seasons —
  // 2024 (B) and 2023 (C) — instead of leaving B empty and blindly redistributing its weight onto
  // the (often single-game) recency bucket. This anchors form on real LPL seasons, not a void.
  const seasonRecentStart = isLpl ? "2024-01-01" : "2025-01-01";
  const seasonRecentEnd = isLpl ? "2025-01-01" : "2026-01-01";
  const seasonPriorStart = isLpl ? "2023-01-01" : "2024-01-01";
  const seasonPriorEnd = isLpl ? "2024-01-01" : "2025-01-01";

  const purse = auctionConfig.purse_per_friend;
  const numFriends = auctionConfig.num_friends || 1;
  const playersPerFriend = auctionConfig.players_per_friend || 35;
  const numCaptains = auctionConfig.num_captains || 1;
  const numViceCaptains = auctionConfig.num_vice_captains || 1;
  // House-rule lever (default OFF so every other auction is unaffected):
  //  - changesAllowed: in-tournament C/VC armband moves permitted per friend → movable-armband
  //    premium (wider band, lower peak) instead of the fixed C/VC tiers.
  const changesAllowed = auctionConfig.changes_allowed || 0;
  const totalMoney = purse * numFriends;
  const topN = numFriends * playersPerFriend;

  // --- Pool ---
  const pool = await sqlite
    .prepare(
      `SELECT ap.id, ap.player_id, ap.status, ap.squad_number, ap.ipl_team, p.role, p.name AS name, COALESCE(ap.price_manual, 0) as price_manual, COALESCE(ap.efppm, 0) as efppm, COALESCE(ap.sold_price, 0) as sold_price
       FROM auction_pool ap
       JOIN players p ON ap.player_id = p.id
       WHERE ap.tournament_id = ?`
    )
    .all(tournamentId) as PoolPlayer[];

  const availPool = pool.filter((p) => p.status === "AVAILABLE");
  if (availPool.length === 0) return;

  const playerIds = availPool.map((p) => p.player_id);
  const placeholders = playerIds.map(() => "?").join(",");

  // Top-8 nations filter for T20I quality
  const top8Placeholders = TOP_8_NATIONS.map(() => "?").join(",");

  // Quality-form filter + recency windows. For the women's ODI tour, quality = ALL women's ODIs
  // (no opposition gate, no T20 supplement) and the windows widen (women's ODIs are infrequent):
  // last-10 over 48mo (effectively "10 most recent"), all-form over 36mo. Non-ODI tours keep the
  // exact prior behaviour (T20 quality list + top-8 T20I supplement; 24mo / 30mo) — byte-identical.
  const qualityClause = isTest
    // Red ball only, and NO opposition gate: Test cricket is already a 9-team sample, so gating it
    // would mostly discard real evidence. 'FC' is excluded on purpose — see the isTest note above.
    ? `format = 'TEST'`
    : isWomensOdi
    ? `format = 'ODI'`
    : isMensOdi
    ? `format = 'ODI' AND opposition IN (${top8Placeholders})`
    : `format IN (${qualityList}) OR (format = 'T20' AND opposition IN (${top8Placeholders}))`;
  // women's ODI binds no extra params; men's ODI + T20 both bind the top-8 nation list.
  const qualityParams = isWomensOdi || isTest ? [] : TOP_8_NATIONS;
  // Test windows are much wider than the white-ball ones. England play ~12 Tests a year and
  // Pakistan fewer, so a 24-month window would leave half this squad on 3-6 matches and turn the
  // recency bucket into noise. 60 months of Tests is roughly 24 months of T20I density.
  const last15Window = isTest
    ? "-60 months"
    : isWomensOdi
    ? "-48 months"
    : isMensOdi
    ? "-36 months"
    : "-24 months";
  const allWindow = isTest ? "-60 months" : isWomensOdi || isMensOdi ? "-36 months" : "-30 months";

  // --- Batch Query: Score 1 sources ---

  // A: Last 15 quality T20 matches per player
  const last15Rows = await sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM (
         SELECT player_id, fantasy_points,
           ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY match_date DESC) as rn
         FROM match_performances
         WHERE player_id IN (${placeholders})
           AND (${qualityClause})
           AND match_date >= date('now', '${last15Window}')
       )
       WHERE rn <= 15
       GROUP BY player_id`
    )
    .all(...playerIds, ...qualityParams) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const last15Map = new Map(last15Rows.map((r) => [r.player_id, r]));

  // B: most-recent league season avg FP (default 2025; LPL → 2024)
  const ipl2025Rows = await sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format = '${leagueFmt}' AND match_date >= '${seasonRecentStart}' AND match_date < '${seasonRecentEnd}'
       GROUP BY player_id`
    )
    .all(...playerIds) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const ipl2025Map = new Map(ipl2025Rows.map((r) => [r.player_id, r]));

  // C: prior league season avg FP (default 2024; LPL → 2023)
  const ipl2024Rows = await sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format = '${leagueFmt}' AND match_date >= '${seasonPriorStart}' AND match_date < '${seasonPriorEnd}'
       GROUP BY player_id`
    )
    .all(...playerIds) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const ipl2024Map = new Map(ipl2024Rows.map((r) => [r.player_id, r]));

  // D: All quality T20 last 2.5yr
  const t20AllRows = await sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND (${qualityClause})
         AND match_date >= date('now', '${allWindow}')
       GROUP BY player_id`
    )
    .all(...playerIds, ...qualityParams) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const t20AllMap = new Map(t20AllRows.map((r) => [r.player_id, r]));

  // For the Hundred: each player's fraction of recent quality games that ARE Hundred games,
  // used to blend the per-role scale normalization (Hundred games already on-scale; the rest
  // scaled by HUNDRED_ROLE_NORM). Empty for non-Hundred tours.
  const hunFracMap = new Map<number, number>();
  const qualNMap = new Map<number, number>(); // player -> total quality games (30mo), for shrinkage
  // Test: sample size is counted in INNINGS, not matches. A Test is up to two innings per player,
  // and it is innings that generate the milestone/haul events the average is built from, so innings
  // is the honest unit — counting matches would roughly halve n and double the shrinkage.
  const testInnsMap = new Map<number, number>();
  const testRolePrior = isTest ? await computeTestRolePrior() : null;
  if (isTest) {
    const innRows = (await sqlite
      .prepare(
        `SELECT player_id, innings_detail FROM match_performances
          WHERE player_id IN (${placeholders}) AND format = 'TEST'
            AND match_date >= date('now', '${allWindow}')`
      )
      .all(...playerIds)) as Array<{ player_id: number; innings_detail: string | null }>;
    for (const r of innRows) {
      let n = 1; // pre-innings_detail rows (or a no-event appearance) count as a single innings
      if (r.innings_detail) {
        try {
          const parsed = JSON.parse(r.innings_detail);
          if (Array.isArray(parsed)) n = parsed.length;
        } catch {
          /* malformed JSON — fall back to 1 rather than dropping the appearance */
        }
      }
      testInnsMap.set(r.player_id, (testInnsMap.get(r.player_id) ?? 0) + n);
    }
  }
  if (isHundred) {
    const hunFracRows = await sqlite
      .prepare(
        `SELECT player_id,
           SUM(CASE WHEN format='HUN' THEN 1 ELSE 0 END) AS hun, COUNT(*) AS tot
         FROM match_performances
         WHERE player_id IN (${placeholders})
           AND format IN (${qualityList})
           AND match_date >= date('now','-30 months')
         GROUP BY player_id`
      )
      .all(...playerIds) as Array<{ player_id: number; hun: number; tot: number }>;
    for (const r of hunFracRows) {
      hunFracMap.set(r.player_id, r.tot > 0 ? r.hun / r.tot : 0);
      qualNMap.set(r.player_id, r.tot);
    }
  }

  // --- Score 2 (venue conditions): REMOVED 5 Aug 2026, by decision ---
  // EFPPM no longer carries ANY venue adjustment. The venue work is kept as pure INFORMATION
  // (the Bat Index, surfaced in the venue UI) so you can see which grounds favour bat or ball and
  // by how much — but it never moves a price.
  //
  // Why it was dropped rather than improved: the honest effect size did not justify the machinery.
  // Measured leave-one-out (the player excluded from the ground average he is scored against, since
  // a batter sits in the index's numerator and a bowler in its denominator), the true venue
  // elasticity is only +0.21 for batters / -0.23 for bowlers / ~0 for all-rounders — worth about 2%
  // on a player's value. For comparison, phased overseas availability moved CPL players 30-50% and
  // the cumulative-milestone scoring bug was worth ~6% on any innings of 50+. Roughly half of every
  // larger elasticity previously measured (0.72, then 0.36) was that circularity, not signal.
  //
  // The venue REGISTRY (src/lib/registry/venues.json) stays and is still worth having — it fixed
  // genuinely wrong ground data, where 651 cricsheet spellings were really 459 grounds.

  // --- Batch Query: Bowling overs avg ---
  const bowlOversRows = await sqlite
    .prepare(
      `SELECT player_id, AVG(CAST(bowl_balls AS REAL) / 6.0) as avg_overs
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format = '${leagueFmt}'
         AND bowl_balls > 0
       GROUP BY player_id`
    )
    .all(...playerIds) as Array<{ player_id: number; avg_overs: number }>;
  const bowlOversMap = new Map(
    bowlOversRows.map((r) => [r.player_id, r.avg_overs])
  );

  // --- Batch Query: Ceiling (avg of top-10% matches) ---
  const ceilingRows = await sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as ceiling_avg, cnt FROM (
        SELECT player_id, fantasy_points, cnt,
          NTILE(10) OVER (PARTITION BY player_id ORDER BY fantasy_points DESC) as tile
        FROM (
          SELECT player_id, fantasy_points,
            COUNT(*) OVER (PARTITION BY player_id) as cnt
          FROM match_performances
          WHERE player_id IN (${placeholders})
            AND (${qualityClause})
            AND match_date >= date('now', '${allWindow}')
        )
      )
      WHERE tile = 1
      GROUP BY player_id`
    )
    .all(...playerIds, ...qualityParams) as Array<{
    player_id: number;
    ceiling_avg: number;
    cnt: number;
  }>;
  const ceilingMap = new Map(
    ceilingRows.map((r) => [r.player_id, { ceilingAvg: r.ceiling_avg, cnt: r.cnt }])
  );

  // --- Compute valuations ---
  const results: Array<{
    id: number;
    efppm: number;
    seasonValue: number;
    bowlOversAvg: number | null;
  }> = [];

  // Data-driven per-role scale factors for the Hundred (measured this run from HUN vs T20I at the
  // Hundred grounds — see computeHundredRoleNorm). null for non-Hundred tours (normMult stays 1).
  const hundredRoleNorm = isHundred
    ? await computeHundredRoleNorm(isHundredWomen ? "female" : "male")
    : null;

  for (const p of availPool) {
    // Score 1
    const last15 = last15Map.get(p.player_id);
    const ipl2025 = ipl2025Map.get(p.player_id);
    const ipl2024 = ipl2024Map.get(p.player_id);
    const t20All = t20AllMap.get(p.player_id);

    const rawScore1 = computeScore1({
      last15Avg: last15?.avg_fp ?? 0,
      last15Count: last15?.cnt ?? 0,
      ipl2025Avg: ipl2025?.avg_fp ?? 0,
      ipl2025Count: ipl2025?.cnt ?? 0,
      ipl2024Avg: ipl2024?.avg_fp ?? 0,
      ipl2024Count: ipl2024?.cnt ?? 0,
      t20_2_5yrAvg: t20All?.avg_fp ?? 0,
      t20_2_5yrCount: t20All?.cnt ?? 0,
    }, score1Weights);

    // Small-sample shrinkage (empirical-Bayes: regress form toward a prior of 40 — ~the LPL pool
    // median EFPPM, a real "league-average" anchor — by k=5 pseudo-games).
    //  - Hundred: total-N shrinkage on qualNMap (unchanged; statless → 40).
    //  - LPL: PER-BUCKET shrinkage. The distortion here is NOT "few total games" (Samarawickrama
    //    has 10 quality games in 30mo) — it's that with no 2025 LPL season the recency bucket (A)
    //    carries 57% of the weight on a SINGLE 116-FP game. Shrinking each bucket by ITS OWN count
    //    (a 1-game bucket collapses toward 40: (1·116+5·40)/6 ≈ 53; a 9/10-game bucket barely
    //    moves) deflates exactly that lone-game bucket, then re-blends with the same weights and
    //    zero-count redistribution as the raw score. Well-sampled stars (high count in every
    //    bucket) are left intact. Statless players stay at the baseline (all buckets excluded → 20).
    // All other tours use the raw estimate.
    const SHRINK_K = 5;
    const SHRINK_PRIOR = 40;
    const shrinkAvg = (avg: number, cnt: number) =>
      cnt > 0 ? (cnt * avg + SHRINK_K * SHRINK_PRIOR) / (cnt + SHRINK_K) : avg;
    let score1: number;
    if (isTest) {
      // Empirical-Bayes toward the role prior, k=3 pseudo-innings, n in innings.
      // Plus a hard floor: under TEST_MIN_INNINGS the player gets NO credit for their own number
      // and sits on the prior outright. One or two innings is not evidence — Awais Zafar's single
      // 13-point Test would otherwise drag him below a player with no record at all, which says
      // more about one dismissal than about him.
      const TEST_SHRINK_K = 3;
      const TEST_MIN_INNINGS = 3;
      const prior =
        testRolePrior?.[p.role] ?? TEST_PRIOR_FALLBACK[p.role] ?? TEST_PRIOR_FALLBACK.BAT;
      const n = testInnsMap.get(p.player_id) ?? 0;
      score1 =
        n < TEST_MIN_INNINGS
          ? prior
          : (n * rawScore1 + TEST_SHRINK_K * prior) / (n + TEST_SHRINK_K);
    } else if (isHundred) {
      const n = qualNMap.get(p.player_id) ?? 0;
      score1 = (n * rawScore1 + SHRINK_K * SHRINK_PRIOR) / (n + SHRINK_K);
    } else if (isLpl || isCpl) {
      // CPL uses the same PER-BUCKET shrinkage as LPL. The trigger differs slightly: CPL's season
      // buckets are populated, but a squad of 122 is full of players with a 1–3 game CPL season
      // (uncapped domestics, breakout picks, overseas cameos), and a single big score in a 1-game
      // bucket carrying 30% weight is exactly the artifact that sent S Samarawickrama to 68 EFPPM.
      score1 = computeScore1({
        last15Avg: shrinkAvg(last15?.avg_fp ?? 0, last15?.cnt ?? 0),
        last15Count: last15?.cnt ?? 0,
        ipl2025Avg: shrinkAvg(ipl2025?.avg_fp ?? 0, ipl2025?.cnt ?? 0),
        ipl2025Count: ipl2025?.cnt ?? 0,
        ipl2024Avg: shrinkAvg(ipl2024?.avg_fp ?? 0, ipl2024?.cnt ?? 0),
        ipl2024Count: ipl2024?.cnt ?? 0,
        t20_2_5yrAvg: shrinkAvg(t20All?.avg_fp ?? 0, t20All?.cnt ?? 0),
        t20_2_5yrCount: t20All?.cnt ?? 0,
      }, score1Weights);
    } else {
      score1 = rawScore1;
    }

    // Hundred: convert the (mostly non-Hundred) proxy form to the D11 Hundred scale, weighted
    // by how much of the player's recent quality history is actually Hundred. normMult=1 else.
    let normMult = 1.0;
    if (isHundred) {
      const hf = hunFracMap.get(p.player_id) ?? 0;
      const rf =
        hundredRoleNorm?.[p.role as HundredRole] ??
        HUNDRED_ROLE_NORM[p.role as HundredRole] ??
        1.0;
      normMult = hf + (1 - hf) * rf;
    }
    const normScore1 = score1 * normMult;

    // NO venue adjustment. EFPPM is form only (see the Score-2 note above) — venue is reported as
    // information via the Bat Index, never priced in.
    const finalEfppm = normScore1;
    const expectedMatches = isHundred
      ? hundredExpectedMatches(p.ipl_team, p.squad_number, isHundredWomen)
      : isTest
      ? testExpectedMatches(p.squad_number)
      : isBilateral
      ? bilateralExpectedMatches(p.squad_number)
      : isWomensOdi
      ? odiExpectedMatches(p.squad_number)
      : isMensOdi
      ? mensOdiExpectedMatches(p.squad_number)
      : isMLC
      ? mlcExpectedMatches(p.ipl_team, p.squad_number)
      : isLpl
      ? lplExpectedMatchesFor(p.name, p.squad_number)
      : isCpl
      // Name-keyed, because CPL 2026's phased overseas rotation makes squad_number a bad proxy:
      // a "bench" number can be a first-3-games specialist and an XI number a 7-of-10 player.
      ? cplExpectedMatchesFor(p.name, p.squad_number)
      : isWomensWC
      ? getWomensExpectedMatches(p.squad_number, WC_TEAM_TIERS[p.ipl_team] ?? "C")
      : getExpectedMatches(p.squad_number);

    // Ceiling premium: explosive players (high top-10% avg) get a boost
    const ceilData = ceilingMap.get(p.player_id);
    let ceilingBonus = 1.0;
    const ceilAvg = ceilData ? ceilData.ceilingAvg * normMult : 0; // same Hundred-scale normalization
    if (ceilData && ceilAvg > finalEfppm) {
      const ceilingRatio = (ceilAvg - finalEfppm) / finalEfppm;
      const effectiveAlpha = 0.15 * Math.min(ceilData.cnt / 25, 1.0);
      ceilingBonus = 1 + effectiveAlpha * ceilingRatio;
    }

    const seasonValue = finalEfppm * expectedMatches * ceilingBonus;

    const bowlOversAvg =
      p.role === "BOWL" || p.role === "AR"
        ? bowlOversMap.get(p.player_id) ?? null
        : null;

    results.push({ id: p.id, efppm: finalEfppm, seasonValue, bowlOversAvg });
  }

  // --- Budget-balanced pricing ---
  // Sort by seasonValue desc, take top N
  const sorted = [...results].sort((a, b) => b.seasonValue - a.seasonValue);

  // C/VC premium: only the genuine top players in the WHOLE pool are real
  // Captain/Vice-Captain picks. Rank ALL players (sold + available) by EFPPM:
  // the top (friends*captains) ranks are Captain slots, the next
  // (friends*viceCaptains) are VC slots. A SOLD player in those bands CONSUMES
  // its slot — the premium does NOT cascade down to whoever is now top of the
  // available list (a mid-tier player isn't a captain pick just because the
  // real marquees are gone).
  const totalCSlots = numFriends * numCaptains;
  const totalVCSlots = numFriends * numViceCaptains;

  const ranked = [
    ...pool
      .filter((p) => p.status === "SOLD" && p.efppm > 0)
      .map((p) => ({ efppm: p.efppm, id: -1 })), // sold occupies a slot, id<0
    ...sorted.map((s) => ({ efppm: s.efppm, id: s.id })),
  ].sort((a, b) => b.efppm - a.efppm);

  const premiumById = new Map<number, number>();
  if (changesAllowed > 0) {
    // Movable-armband model (in-tournament C/VC changes allowed). Base points always
    // accrue for every game a player features; only the ×2 / ×1.5 multiplier moves. So
    // the captaincy multiplier is a FLEXIBLE resource spread across a friend's top players
    // over the season rather than locked onto one. Two consequences:
    //  (a) the premium BAND widens — beyond the (numFriends × (C+VC)) armband slots held
    //      at any instant, ~60% of the mobility headroom (numFriends × changesAllowed)
    //      brings extra distinct names into armband contention (capped below the naive
    //      ceiling because friends chase the same elite players); and
    //  (b) the PEAK drops to 1.6× — a captain counts ×2, but the top player wears the C
    //      only ~60% of games → 1 + 0.6 × (2 − 1) ≈ 1.6. Decays linearly to 1.0× at the
    //      band edge. A SOLD player still consumes its rank (no cascade).
    const fixedBand = numFriends * (numCaptains + numViceCaptains);
    const mobilityBand = numFriends * changesAllowed * 0.6;
    const premiumBand = Math.round(fixedBand + mobilityBand);
    const peakPremium = 1.6;
    for (let i = 0; i < ranked.length && i < premiumBand; i++) {
      const r = ranked[i];
      if (r.id < 0) continue; // sold player consumes its rank — no cascade
      premiumById.set(r.id, 1 + (peakPremium - 1) * ((premiumBand - i) / premiumBand));
    }
  } else {
    // Fixed-armband model (default): hard C/VC tiers.
    for (let i = 0; i < ranked.length && i < totalCSlots + totalVCSlots; i++) {
      const r = ranked[i];
      if (r.id < 0) continue; // sold player consumes the slot — no cascade
      premiumById.set(r.id, i < totalCSlots ? 1.8 : 1.35);
    }
  }
  for (const s of sorted) {
    const mult = premiumById.get(s.id);
    if (mult) s.seasonValue *= mult;
  }

  // Normalize over what's ACTUALLY LEFT, not the full pool — otherwise prices
  // of remaining players inflate as money/slots get consumed by sold players.
  const spentMoney = pool
    .filter((p) => p.status === "SOLD")
    .reduce((s, p) => s + (p.sold_price || 0), 0);
  const filledSlots = pool.filter((p) => p.status === "SOLD").length;
  const remainingMoney = Math.max(0, totalMoney - spentMoney);
  const remainingSlots = Math.max(1, topN - filledSlots);

  const topPlayers = sorted.slice(0, remainingSlots);
  const topPlayerIds = new Set(topPlayers.map((p) => p.id));

  // Split remaining slots: bottom 10% get base price (1 Cr), rest get real prices
  const baseSlots = Math.min(Math.ceil(remainingSlots * 0.1), topPlayers.length);
  const realPlayers = topPlayers.slice(0, topPlayers.length - baseSlots);
  const basePlayers = topPlayers.slice(topPlayers.length - baseSlots);

  const baseBudget = baseSlots * 1; // 1 Cr each for base-price players
  const realBudget = Math.max(0, remainingMoney - baseBudget);
  const realTotal = realPlayers.reduce((s, v) => s + v.seasonValue, 0);

  // Build price map — whole numbers, no floor/ceiling multipliers
  const priceMap = new Map<number, { expected: number; floor: number; ceiling: number }>();

  for (const v of realPlayers) {
    const expected = Math.max(Math.round(
      realTotal > 0 ? (v.seasonValue / realTotal) * realBudget : 0
    ), 2);
    priceMap.set(v.id, { expected, floor: expected, ceiling: expected });
  }

  for (const v of basePlayers) {
    priceMap.set(v.id, { expected: 1, floor: 1, ceiling: 1 });
  }

  // Players outside top N: 1 Cr base
  for (const v of results) {
    if (!topPlayerIds.has(v.id)) {
      priceMap.set(v.id, { expected: 1, floor: 1, ceiling: 1 });
    }
  }

  // --- Write to DB ---
  // Build set of manually-priced pool IDs so we skip their price columns
  const manualIds = new Set(pool.filter((p) => p.price_manual === 1).map((p) => p.id));

  await withTransaction(async (tx) => {
    // Prepared from `tx` so the writes actually run INSIDE the transaction.
    const updateStmt = tx.prepare(`
    UPDATE auction_pool
    SET efppm = ?, val_floor = ?, val_expected = ?, val_ceiling = ?, bowl_overs_avg = ?
    WHERE id = ?
  `);

    const updateManualStmt = tx.prepare(`
    UPDATE auction_pool
    SET efppm = ?, bowl_overs_avg = ?
    WHERE id = ?
  `);

    for (const v of results) {
      if (manualIds.has(v.id)) {
        // Only update EFPPM + bowling overs, preserve user's manual price
        await updateManualStmt.run(
          Math.round(v.efppm * 100) / 100,
          v.bowlOversAvg !== null ? Math.round(v.bowlOversAvg * 10) / 10 : null,
          v.id
        );
      } else {
        const price = priceMap.get(v.id)!;
        await updateStmt.run(
          Math.round(v.efppm * 100) / 100,
          Math.round(price.floor * 100) / 100,
          Math.round(price.expected * 100) / 100,
          Math.round(price.ceiling * 100) / 100,
          v.bowlOversAvg !== null ? Math.round(v.bowlOversAvg * 10) / 10 : null,
          v.id
        );
      }
    }
  });
}

export async function initializeValuations(
  tournamentId: number | string,
  auctionId?: number | string
) {
  await recalculateValuations(tournamentId, auctionId);
  await sqlite
    .prepare("UPDATE tournaments SET status = 'AUCTION' WHERE id = ?")
    .run(tournamentId);
}
