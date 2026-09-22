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
  ENG_SL_IND_AFG_T20_2026_NAME,
  twinT20ExpectedMatches,
  twinOppositionFactor,
} from "@/lib/squads/eng-sl-ind-afg-t20-2026";
import {
  SA_AUS_ENG_SL_ODI_2026_NAME,
  twinOdiExpectedMatches,
  twinOdiOppositionFactor,
} from "@/lib/squads/sa-aus-eng-sl-odi-2026";
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
import {
  ETPL_2026_NAME,
  etplExpectedMatchesFor,
} from "@/lib/squads/etpl-2026";
import {
  WCPL_2026_NAME,
  wcplExpectedMatches,
} from "@/lib/squads/wcpl-2026";

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

// ETPL shrinkage prior: the expected mean T20 FP of a player in each role, MEASURED on the same
// widened quality set the tour is scored on. A flat prior of 40 (what the franchise leagues use) is
// wrong here in both directions: 40 is roughly the median of an IPL/CPL pool, whereas an ETPL squad
// is half uncapped associate cricketers, and a bowler's FP distribution sits well below a batter's
// once you stop filtering out associate fixtures. Shrinking every role toward one number would
// quietly transfer value from bowlers to batters.
//
// Measured as the mean of PLAYER MEANS (not of raw rows), for the same reason as the Test prior:
// the quantity being shrunk is one player's average, so the prior must describe how player averages
// are distributed rather than being weighted by games played. Players need >= ETPL_PRIOR_MIN_GAMES
// in the window to contribute, so the prior is not itself built from the small samples it exists to
// correct. The weak-opposition discount is applied here too, so prior and estimate share a scale.
const ETPL_PRIOR_MONTHS = 30;
const ETPL_PRIOR_MIN_GAMES = 10;  // per player, to contribute to the prior
const ETPL_PRIOR_MIN_PLAYERS = 10; // per role, else fall back to the pooled all-role prior
const ETPL_PRIOR_FALLBACK: Record<string, number> = {
  BAT: 40, WK: 40, AR: 42, BOWL: 38,
};

async function computeEtplRolePrior(
  qualityList: string,
  fpExpr: string,
  fpParams: string[]
): Promise<Record<string, number>> {
  const rows = (await sqlite
    .prepare(
      `SELECT role, AVG(pm) AS prior, COUNT(*) AS players FROM (
         SELECT p.role AS role, AVG(${fpExpr}) AS pm
           FROM match_performances mp
           JOIN players p ON p.id = mp.player_id
          WHERE mp.format IN (${qualityList})
            AND (p.gender = 'male' OR p.gender IS NULL)
            AND mp.match_date >= date('now', '-${ETPL_PRIOR_MONTHS} months')
          GROUP BY p.id
         HAVING COUNT(*) >= ${ETPL_PRIOR_MIN_GAMES}
       )
       GROUP BY role`
    )
    .all(...fpParams)) as Array<{ role: string | null; prior: number; players: number }>;

  const out: Record<string, number> = { ...ETPL_PRIOR_FALLBACK };
  const pooled =
    rows.reduce((a, r) => a + r.prior * r.players, 0) /
    Math.max(1, rows.reduce((a, r) => a + r.players, 0));
  for (const r of rows) {
    if (!r.role) continue;
    out[r.role] = r.players >= ETPL_PRIOR_MIN_PLAYERS ? r.prior : pooled;
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
  // ETPL 2026: the INAUGURAL European T20 Premier League. Modelled as a franchise T20 league, but
  // with two deliberate departures forced by it being a first season:
  //   (1) NO league-season buckets. leagueFmt is set to a format that does not exist in the DB, so
  //       buckets B/C come back empty and computeScore1 redistributes their 40% onto A (last-10
  //       form) and D (all quality form) — effectively 67/33. This is honest: there is no ETPL
  //       history, and no other league is a fair proxy. Using BLAST+HUN as a stand-in "primary
  //       league" was considered and rejected — only the county-based ENG/SCO/IRE half of the pool
  //       has that data, so it would systematically outbid the Dutch contingent for no real reason.
  //   (2) The WIDEST quality set of any tour here, and the ONLY one that counts the Vitality Blast
  //       ('BLAST') and unrestricted T20Is. Every other league excludes BLAST as "a tier below that
  //       would swamp the sample" — but for ETPL the Blast and the Hundred ARE where this pool's
  //       form lives, and its associate players' records are almost entirely T20Is against
  //       non-top-8 opposition. Measured on the actual 99-man pool: the standard gate (IPL/WPL +
  //       top-8 T20Is) leaves 47 of 99 players with under 5 qualifying matches, i.e. sitting at
  //       baseline 20 — including James Vince, Jason Roy, Chris Jordan, Steve Smith, Laurie Evans
  //       and Tom Curran. Widening it drops that to 12, and those 12 are genuinely dataless
  //       uncapped draft picks, which is the correct answer for them.
  //       The cost of widening is that a T20I against Nepal would otherwise price like one against
  //       South Africa, so ETPL_ASSOCIATE_FP_MULT discounts non-top-8-opposition T20Is (see below).
  // Shrinkage is ON and stronger in effect than elsewhere: k=5 toward a MEASURED per-role prior
  // (not the flat 40), because a third of this pool has under 10 recorded T20s.
  // Venue is OFF: only two grounds, and all six teams play the same 15/15 split, so a conditions
  // factor carries no relative signal whatsoever.
  const isEtpl = tournamentRow?.name === ETPL_2026_NAME;
  // WCPL 2026: the Women's Caribbean Premier League — a women's franchise T20, and a TINY one:
  // 4 teams, 8 matches, ALL of them at Kensington Oval. Modelled like CPL/LPL (20-over franchise
  // league) with its OWN 'WCPL' league bucket, and this is the FIRST tour to use that bucket — the
  // cricsheet archive code is `wcl`, not `wcpl` (25 matches, 2022-2025, ingested 4 Sep 2026).
  // Quality = the women's marquee set (WCPL/WPL/T20/WBBL, HUN deliberately out — see below); the
  // DEFAULT 40/30/10/20 weights apply because WCPL ran real 2025 and 2024 seasons, so unlike LPL
  // there is nothing to slide back to; per-bucket small-sample shrinkage ON, same as CPL/LPL; plus
  // one thing no men's tour needs, a league SCALE UPLIFT (WCPL_SCALE_UPLIFT, below).
  // Venue is OFF, deliberately: every one of the 8 matches is at the one ground, so a venue factor
  // would be the same constant for all 59 players and carries ZERO relative signal. Same call as
  // ETPL, and it is why isWcpl appears in no venue path anywhere in this file.
  const isWcpl = tournamentRow?.name === WCPL_2026_NAME;
  // ENG v SL + IND v AFG T20I 2026: ONE pool spanning TWO concurrent 3-match bilateral T20I series.
  // Bilateral in every respect that a single series is — no league season, so the 60/40 recency
  // weights apply, and expected matches is a flat 3/1 — plus the two things that only a
  // multi-series pool needs:
  //   (a) an OPPOSITION FACTOR, because England's runs come against Sri Lanka and Sri Lanka's
  //       against England, and with one shared purse that difference no longer cancels out. It is
  //       applied through normMult, the same slot the Hundred and WCPL scale corrections use, so it
  //       reaches the ceiling premium consistently instead of only the headline EFPPM.
  //   (b) the ETPL QUALITY SET rather than the bilateral 'MLC','IPL' one. This is NOT a preference:
  //       cricsheet withholds every Afghanistan men's match as policy, so the whole AFG squad has
  //       no T20I record here and is carried entirely by franchise-league rows. Under the standard
  //       gate all 15 sit at baseline 20. The ETPL set also brings BLAST/HUN, which is what the
  //       England fringe (Banton, Cox, Donald, Coles, Baker) actually plays, and its weak-opposition
  //       discount + Hundred scale uplift come along with it — both wanted here for the same reasons.
  // Venue is display-only for every tour now (finalEfppm = normScore1), so no venue path is needed.
  const isTwinT20 = tournamentRow?.name === ENG_SL_IND_AFG_T20_2026_NAME;
  // SA v AUS + ENG v SL ODI 2026: the TWIN structure above crossed with the MEN'S ODI form model.
  // Two concurrent 3-match ODI series, one pool, one purse. It takes from isTwinT20 only the
  // opposition factor (a shared purse across two series), and from isMensOdi everything about how
  // form is scored: `format='ODI'` alone, gated to top-8 opposition, 36-month windows.
  //
  // Deliberately NOT inherited from the T20 twin: the ETPL quality set and its weak-opposition
  // discount / Hundred uplift. Those exist to rescue a squad whose T20I record cricsheet withholds
  // (Afghanistan). Here all four sides are top-8 nations with full ODI records, so the standard
  // men's ODI gate is both sufficient and tighter — widening it would only import namesakes and
  // off-format form. Expected matches is the flat 3/1 of the T20 twin, NOT the 5/2 of the
  // five-match NZ v WI ODI series: these series are three matches with no dead rubber.
  const isTwinOdi = tournamentRow?.name === SA_AUS_ENG_SL_ODI_2026_NAME;
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
  // NOTE ETPL -> "ETPL", a format string that appears NOWHERE in match_performances. That is
  // intentional, not a bug: it makes the two league-season buckets provably empty so their weight
  // redistributes onto the form buckets. See the isEtpl note above.
  // WCPL -> "WCPL", which DOES exist in match_performances (25 matches, 2022-2025). It gets the
  // DEFAULT calendar season buckets and they must NOT slide back the way LPL's do: WCPL ran a real
  // 2025 season (Sep 2025) and a 2024 one, so buckets B and C are genuinely populated and the
  // default 40/30/10/20 weights apply — identical reasoning to CPL, hence no score1Weights entry.
  const leagueFmt = isHundred ? "HUN" : isMLC ? "MLC" : isLpl ? "LPL" : isCpl ? "CPL" : isWcpl ? "WCPL" : isEtpl ? "ETPL" : "IPL";
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
    : isWcpl
    // The women's marquee set. Identical to the isHundredWomen list ABOVE except for one
    // deliberate omission: 'HUN' is EXCLUDED. The Hundred is a 100-ball competition played on a
    // systematically lower FP scale, and unlike the Hundred build — whose TARGET scale IS the
    // Hundred, so its own rows are the on-scale ones — the target scale here is the 20-over one.
    // Counting HUN rows would therefore silently DEFLATE exactly the players with the heaviest
    // Hundred exposure: Kapp, Lanning, Bates, Matthews, Tryon. Every one of them has ample
    // WBBL / WPL / women's-T20I history, so excluding the Hundred costs their sample nothing.
    // (The alternative — keeping HUN and scaling it up per role, as ETPL does — is not worth the
    // machinery for a 59-player pool where the affected players are all richly sampled elsewhere.)
    // Note that listing 'T20' means the top-8-opposition gate does NOT bind: ALL women's T20Is
    // count, the same call as the Hundred Women, because the women's sample is thin and gating it
    // on opposition would starve it.
    ? "'WCPL','WPL','T20','WBBL'"
    : isEtpl || isTwinT20
    // The widest set here, and the ONLY one that includes BLAST and unrestricted 'T20'. Listing
    // 'T20' inside the format list means the top-8-opposition gate no longer binds — every T20I
    // counts, associate fixtures included, because for half this pool that IS the entire record.
    // BLAST is in for the same reason: the Blast and the Hundred are where the Irish, Scottish and
    // England-county players actually play. The quality trade-off is handled by discounting weak
    // opposition (ETPL_ASSOCIATE_FP_MULT), not by excluding it.
    ? "'T20','BLAST','HUN','IPL','BBL','PSL','SA20','ILT20','CPL','LPL','MLC'"
    : isMLC || isBilateral
    ? "'MLC','IPL'"
    : "'IPL','WPL'";

  // Opposition-strength discount, ETPL only. Widening the gate to all T20Is lets a hundred against
  // Nepal count the same as one against South Africa, which it plainly is not. Rather than throw
  // the associate record away (that is what breaks the model — see isEtpl), each T20I against
  // NON-top-8 opposition is scaled to 85% of its face fantasy points. Franchise-league and
  // domestic rows (BLAST, HUN, IPL, BBL, ...) are NOT discounted: those are full professional
  // competitions, and discounting them would re-create the very bias being fixed.
  // 0.85 is a judgement call, not a measured constant. It is deliberately mild: strong enough to
  // stop associate-only records outbidding franchise regulars, small enough that it cannot flip
  // the order of two players who are genuinely far apart. Expect a few % on most prices.
  const ETPL_ASSOCIATE_FP_MULT = 0.85;

  // Second ETPL-only correction, and it pulls the OTHER way. The quality set includes 'HUN', but
  // The Hundred is a 100-BALL competition — five fewer balls an innings than a T20 — so its fantasy
  // points are on a systematically lower scale. Measured over the last 30 months (mean FP per game,
  // HUN vs all 20-over formats, by role):
  //     BAT  38.1 vs 42.8  -> 1.122      WK   44.6 vs 48.8  -> 1.095
  //     AR   51.0 vs 62.4  -> 1.225      BOWL 51.3 vs 52.8  -> 1.029
  // Left uncorrected this silently penalises exactly the players with the FRESHEST evidence: the
  // Hundred ran to 16 Aug 2026, so for Klaasen, Maxwell, Miller, Vince, Livingstone, Santner, Boult,
  // Tim David, Evans, Jordan and Curran those games dominate the recency bucket — which carries 67%
  // of Score1 here, since ETPL has no league-season buckets. In the first pass it dropped Klaasen,
  // Maxwell and Miller BELOW pure-20-over associate records (Aneurin Donald, Logan van Beek), which
  // is not a defensible ranking. So HUN rows are scaled UP to the 20-over scale, per role.
  //
  // This is the mirror image of what the Hundred build does: HUNDRED_ROLE_NORM scales non-Hundred
  // form DOWN onto the Hundred scale (0.85/0.93/0.92/0.99). Same correction, opposite direction,
  // because here the target scale is the 20-over one.
  const ETPL_HUNDRED_UPLIFT: Record<string, number> = {
    BAT: 1.122, WK: 1.095, AR: 1.225, BOWL: 1.029,
  };
  const ETPL_HUNDRED_UPLIFT_FALLBACK = 1.12; // role unset in `players`

  // Composed FP expression: face points x weak-opposition discount x Hundred scale uplift.
  // roleExpr is passed in because the callers reference `players.role` differently — the bucket
  // queries do not join players at all (so they need a correlated subquery), while the role-prior
  // query already has it joined as `p`.
  const etplFpExpr = (roleExpr: string) =>
    `fantasy_points` +
    ` * (CASE WHEN format = 'T20' AND opposition NOT IN (${TOP_8_NATIONS.map(() => "?").join(
      ","
    )}) THEN ${ETPL_ASSOCIATE_FP_MULT} ELSE 1 END)` +
    ` * (CASE WHEN format = 'HUN' THEN (CASE ${roleExpr}` +
    ` WHEN 'BAT' THEN ${ETPL_HUNDRED_UPLIFT.BAT}` +
    ` WHEN 'WK' THEN ${ETPL_HUNDRED_UPLIFT.WK}` +
    ` WHEN 'AR' THEN ${ETPL_HUNDRED_UPLIFT.AR}` +
    ` WHEN 'BOWL' THEN ${ETPL_HUNDRED_UPLIFT.BOWL}` +
    ` ELSE ${ETPL_HUNDRED_UPLIFT_FALLBACK} END) ELSE 1 END)`;

  const fpExpr = isEtpl || isTwinT20
    ? etplFpExpr("(SELECT role FROM players WHERE id = match_performances.player_id)")
    : "fantasy_points";
  // The discount CASE binds its own copy of the nation list, ahead of the quality clause's copy.
  const fpParams = isEtpl || isTwinT20 ? TOP_8_NATIONS : [];

  // WCPL SCALE UPLIFT — the one genuinely new piece of modelling this tour needs, and the MIRROR
  // IMAGE of the Hundred's HUNDRED_ROLE_NORM. The WCPL is a materially WEAKER competition than the
  // WPL, the WBBL or a women's T20I against a top-8 nation: weaker attacks, weaker fielding, more
  // cheap wickets. So the SAME player scores MORE fantasy points in it, and proxy form earned
  // outside the league has to be scaled UP onto the WCPL scale before the two can be compared.
  //
  // MEASURED 4 Sep 2026 over the 36 women with >= 5 WCPL games AND >= 8 non-WCPL quality games in
  // the last 60 months: pooled ratio of mean WCPL FP to mean non-WCPL FP = 1.183.
  //
  // POOLED, NOT PER-ROLE — deliberately, and this is the interesting call. The per-role ratios came
  // out BOWL 1.147 / BAT 1.229 / AR 1.282 / WK 0.817, which looks like a story until you look at
  // the cells: k = 4-11 players each, and the medians disagree with the means (the WK cell is four
  // keepers and flips the sign outright). That is sampling noise wearing the costume of a role
  // effect, and hard-coding it would move real auction money on the strength of four players. One
  // pooled constant is the honest read of the same data, and it is what the normMult block uses.
  const WCPL_SCALE_UPLIFT = 1.18;
  // Bilateral (T20I) AND both ODI archetypes have no league season → recent-form-heavy.
  // LPL: no 2025 edition, and its last real seasons (2024/2023) are ~1–2 yrs old, so lean recency —
  // 45% last-15 form, 20% most-recent LPL season (2024), 10% prior season (2023), 25% all-quality.
  const score1Weights =
    isBilateral || isTwinT20 || isTwinOdi || isWomensOdi || isMensOdi || isTest
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
    : isMensOdi || isTwinOdi
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
    : isMensOdi || isTwinOdi
    ? "-36 months"
    : "-24 months";
  const allWindow =
    isTest ? "-60 months" : isWomensOdi || isMensOdi || isTwinOdi ? "-36 months" : "-30 months";

  // --- Batch Query: Score 1 sources ---

  // A: Last 15 quality T20 matches per player
  // fpExpr is plain `fantasy_points` for every tour except ETPL, which discounts weak-opposition
  // T20Is (see ETPL_ASSOCIATE_FP_MULT). Its placeholders sit in the SELECT list, i.e. AHEAD of the
  // WHERE clause in SQL text order, so fpParams must be bound BEFORE playerIds.
  const last15Rows = await sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM (
         SELECT player_id, ${fpExpr} AS fantasy_points,
           ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY match_date DESC) as rn
         FROM match_performances
         WHERE player_id IN (${placeholders})
           AND (${qualityClause})
           AND match_date >= date('now', '${last15Window}')
       )
       WHERE rn <= 15
       GROUP BY player_id`
    )
    .all(...fpParams, ...playerIds, ...qualityParams) as Array<{
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
      `SELECT player_id, AVG(${fpExpr}) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND (${qualityClause})
         AND match_date >= date('now', '${allWindow}')
       GROUP BY player_id`
    )
    .all(...fpParams, ...playerIds, ...qualityParams) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const t20AllMap = new Map(t20AllRows.map((r) => [r.player_id, r]));

  // Each player's fraction of recent quality games that were played in the TOUR'S OWN format,
  // used to blend the format-scale normalization (own-format games are already on-scale; the rest
  // get scaled). Populated for the Hundred (fraction of HUN games, blended toward
  // HUNDRED_ROLE_NORM) and for WCPL (fraction of WCPL games, blended toward WCPL_SCALE_UPLIFT in
  // the opposite direction). Empty for every other tour, where normMult stays 1.
  const hunFracMap = new Map<number, number>();
  const qualNMap = new Map<number, number>(); // player -> total quality games (30mo), for shrinkage
  // Test: sample size is counted in INNINGS, not matches. A Test is up to two innings per player,
  // and it is innings that generate the milestone/haul events the average is built from, so innings
  // is the honest unit — counting matches would roughly halve n and double the shrinkage.
  const testInnsMap = new Map<number, number>();
  const testRolePrior = isTest ? await computeTestRolePrior() : null;
  // The prior is measured on the SAME corrected scale as the estimates it shrinks toward — using
  // the joined `p.role` rather than the correlated subquery the bucket queries need.
  const etplRolePrior = isEtpl
    ? await computeEtplRolePrior(qualityList, etplFpExpr("p.role"), fpParams)
    : null;
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
  if (isEtpl) {
    // Total quality games in the 30-month window, the n for ETPL's total-N shrinkage.
    const nRows = (await sqlite
      .prepare(
        `SELECT player_id, COUNT(*) AS n FROM match_performances
          WHERE player_id IN (${placeholders})
            AND (${qualityClause})
            AND match_date >= date('now', '${allWindow}')
          GROUP BY player_id`
      )
      .all(...playerIds, ...qualityParams)) as Array<{ player_id: number; n: number }>;
    for (const r of nRows) qualNMap.set(r.player_id, r.n);
  }
  if (isHundred || isWcpl) {
    // Same query, same map, two tours — the only difference is WHICH format counts as "own".
    // For WCPL this also fills qualNMap, which the WCPL path never reads (WCPL shrinks PER BUCKET,
    // not on total N — see the shrinkage block), so it is harmless dead data rather than a branch
    // worth splitting the query over.
    const ownFmt = isWcpl ? "WCPL" : "HUN";
    const hunFracRows = await sqlite
      .prepare(
        `SELECT player_id,
           SUM(CASE WHEN format='${ownFmt}' THEN 1 ELSE 0 END) AS hun, COUNT(*) AS tot
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
          SELECT player_id, ${fpExpr} AS fantasy_points,
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
    .all(...fpParams, ...playerIds, ...qualityParams) as Array<{
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
    } else if (isEtpl) {
      // Total-N shrinkage toward the MEASURED per-role prior, k=5 pseudo-games. Total-N rather than
      // per-bucket (the LPL/CPL choice) because ETPL has no season buckets at all — the distortion
      // to fix is simply "this player has 2 recorded T20s", not "one bucket is carrying 30% weight
      // on a single game". A statless player has n=0 and lands exactly on his role prior, which is
      // a better answer for an uncapped draft pick than computeScore1's flat baseline of 20.
      const prior =
        etplRolePrior?.[p.role] ?? ETPL_PRIOR_FALLBACK[p.role] ?? ETPL_PRIOR_FALLBACK.BAT;
      const n = qualNMap.get(p.player_id) ?? 0;
      score1 = (n * rawScore1 + SHRINK_K * prior) / (n + SHRINK_K);
    } else if (isLpl || isCpl || isWcpl) {
      // CPL uses the same PER-BUCKET shrinkage as LPL. The trigger differs slightly: CPL's season
      // buckets are populated, but a squad of 122 is full of players with a 1–3 game CPL season
      // (uncapped domestics, breakout picks, overseas cameos), and a single big score in a 1-game
      // bucket carrying 30% weight is exactly the artifact that sent S Samarawickrama to 68 EFPPM.
      // WCPL needs it HARDEST of the three. 12 of its 59 players are uncapped local draft picks
      // with no record at all, and a good many of the rest have a 1–3 game WCPL season on top of
      // a thin outside record — in a 25-match league history, a 1-game season bucket carrying 30%
      // of Score 1 is precisely the artifact this removes.
      // The existing SHRINK_PRIOR of 40 was VERIFIED against this pool and is correct on the WCPL
      // scale — do NOT special-case it here. Measured 4 Sep 2026: WCPL per-player mean FP 46.3,
      // median 39.2 across the 63 players with >= 3 games, so 40 really is this league's average
      // player, exactly as it is the LPL/CPL median. (Contrast the Test and ETPL paths, where 40
      // was measurably the WRONG anchor and had to be replaced by a measured per-role prior.)
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

    // Format-scale normalization, blended by how much of the player's recent quality history is
    // already in the tour's own format. Hundred: convert the (mostly non-Hundred) proxy form DOWN
    // to the D11 Hundred scale. WCPL: convert non-WCPL proxy form UP to the WCPL scale. normMult=1
    // for every other tour.
    let normMult = 1.0;
    if (isHundred) {
      const hf = hunFracMap.get(p.player_id) ?? 0;
      const rf =
        hundredRoleNorm?.[p.role as HundredRole] ??
        HUNDRED_ROLE_NORM[p.role as HundredRole] ??
        1.0;
      normMult = hf + (1 - hf) * rf;
    } else if (isWcpl) {
      // Exactly the same correction as HUNDRED_ROLE_NORM, pointed the other way. A player whose
      // recent quality history is ALL WCPL is already on-scale (multiplier 1.0); a player with no
      // WCPL history at all has her outside form scaled up by the full WCPL_SCALE_UPLIFT; anyone
      // in between is blended by her WCPL fraction. Pooled, not per-role — see the constant.
      // WITHOUT this the West Indian locals are systematically OVERPRICED: they are scored largely
      // on WCPL rows that the weak league has already inflated, while the marquee overseas signings
      // who have never played the competition — Lanning, Brits, de Klerk, Bhatia, Mlaba — are
      // scored entirely on the tougher WPL / WBBL / T20I scale and would be marked down for it.
      const wcplFrac = hunFracMap.get(p.player_id) ?? 0;
      normMult = wcplFrac * 1.0 + (1 - wcplFrac) * WCPL_SCALE_UPLIFT;
    } else if (isTwinT20) {
      // OPPOSITION FACTOR — the one piece of modelling a multi-series pool needs that a
      // single-series one does not. Score 1 measures a player's output against his historical mix
      // of opponents; what he will actually be paid for is output against ONE specific side. In a
      // single bilateral that distinction is a constant and cancels out of the relative pricing.
      // Here it does not: England bat against Sri Lanka while Sri Lanka bat against England, and
      // both sets of points are bought from the same purse.
      //
      // It rides in normMult rather than being multiplied onto finalEfppm directly so that the
      // ceiling premium below (which scales ceilAvg by normMult) sees the same adjustment — apply
      // it to only one of the two and a player's ceiling ratio is quietly distorted.
      //
      // Measured within-player; ~+4% for ENG and IND, ~-4% for SL and AFG. Afghanistan's own
      // difficulty is unmeasurable (cricsheet withholds their matches) and is set neutral. See
      // twinOppositionFactor.
      normMult = twinOppositionFactor(p.ipl_team);
    } else if (isTwinOdi) {
      // Same mechanism as the T20 twin above, measured on men's ODI form — but a MUCH smaller and
      // less stable effect, because all four sides here are top-8 nations rather than a top-8 pool
      // containing Afghanistan. It runs about +-2% on price and its sign for SL/SA flips under one
      // of four measurement specifications. Kept because it is the archetype's one required piece
      // and the pre-registered spec matches the 4-spec average; see twinOdiOppositionFactor for the
      // sensitivity table and for how to switch it off (set all four difficulties equal).
      //
      // NOTE the direction is the REVERSE of the T20 twin: there England gained most, here England
      // is the only side meaningfully marked DOWN, because Sri Lanka's spin-led ODI attack (much of
      // it sampled at home) measures as the hardest assignment in this pool.
      normMult = twinOdiOppositionFactor(p.ipl_team);
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
      : isTwinT20
      // Flat 3 / 1: both series are 3 matches, so the XI plays all three either way. No dead
      // rubber to rotate in (the 5-match archetype's bench of 2 assumes one), and no phased
      // overseas availability to model, so squad_number is the whole story.
      ? twinT20ExpectedMatches(p.squad_number)
      : isTwinOdi
      // Flat 3 / 1, same as the T20 twin and for the same reason: both series are 3 matches, the
      // XI plays all three, and there is no dead rubber to rotate in. Explicitly NOT the 5/2 of
      // mensOdiExpectedMatches — that shape belongs to the five-match NZ v WI series.
      ? twinOdiExpectedMatches(p.squad_number)
      : isWomensOdi
      ? odiExpectedMatches(p.squad_number)
      : isMensOdi
      ? mensOdiExpectedMatches(p.squad_number)
      : isMLC
      ? mlcExpectedMatches(p.ipl_team, p.squad_number)
      : isLpl
      ? lplExpectedMatchesFor(p.name, p.squad_number)
      : isEtpl
      // Name-keyed so the two CPL-clash availability overrides can bypass squad_number.
      ? etplExpectedMatchesFor(p.name, p.squad_number)
      : isCpl
      // Name-keyed, because CPL 2026's phased overseas rotation makes squad_number a bad proxy:
      // a "bench" number can be a first-3-games specialist and an XI number a 7-of-10 player.
      ? cplExpectedMatchesFor(p.name, p.squad_number)
      : isWcpl
      // Squad-number-keyed, NOT name-keyed: unlike CPL there is no phased overseas rotation to
      // model here — everyone is available for the whole 13-day window, and the ceiling is 3
      // league games plus at most 2 knockouts. See wcplExpectedMatches (XI 4.0 / 12th 1.2 / 0.6).
      ? wcplExpectedMatches(p.ipl_team, p.squad_number)
      : isWomensWC
      ? getWomensExpectedMatches(p.squad_number, WC_TEAM_TIERS[p.ipl_team] ?? "C")
      : getExpectedMatches(p.squad_number);

    // Ceiling premium: explosive players (high top-10% avg) get a boost
    const ceilData = ceilingMap.get(p.player_id);
    let ceilingBonus = 1.0;
    const ceilAvg = ceilData ? ceilData.ceilingAvg * normMult : 0; // same format-scale normalization
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
