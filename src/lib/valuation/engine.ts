import { sqlite } from "@/db";
import {
  WOMENS_T20_WC_2026_NAME,
  WC_TEAM_TIERS,
  XI_SIZE,
  type StrengthTier,
} from "@/lib/squads/womens-t20-wc-2026";
import { MLC_2026_NAME, mlcExpectedMatches } from "@/lib/squads/mlc-2026";
import {
  IND_VS_ENG_T20_2026,
  IND_VS_ENG_T20_2026_NAME,
  IND_VS_ENG_VENUES,
  bilateralExpectedMatches,
} from "@/lib/squads/ind-vs-eng-t20-2026";
import {
  IRE_VS_WI_W_ODI_2026_NAME,
  odiExpectedMatches,
} from "@/lib/squads/ire-wi-w-odi-2026";
import {
  NZ_VS_WI_MEN_ODI_2026,
  NZ_VS_WI_MEN_ODI_2026_NAME,
  NZ_WI_MEN_ODI_VENUES,
  mensOdiExpectedMatches,
} from "@/lib/squads/nz-wi-men-odi-2026";
import {
  THE_HUNDRED_MEN_2026_NAME,
  THE_HUNDRED_WOMEN_2026_NAME,
  HUNDRED_MEN_2026,
  HUNDRED_VENUES,
  HUNDRED_ROLE_NORM,
  hundredExpectedMatches,
  type Role as HundredRole,
} from "@/lib/squads/the-hundred-2026";
import {
  LPL_2026_NAME,
  lplExpectedMatches,
  LPL_VENUES,
  LPL_TEAM_SCHEDULE,
} from "@/lib/squads/lpl-2026";

/**
 * IPL Auction Valuation Engine — 2-Score Model
 *
 * Score 1: Recency-weighted base EFPPM
 *   A (40%): Last 10 quality T20 matches
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
  squad_number: number;
  ipl_team: string;
  price_manual: number;
  efppm: number;
  sold_price: number;
}

type VenueType = "bat_road" | "balanced" | "bowl_friendly";

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
  last10Avg: number;
  last10Count: number;
  ipl2025Avg: number;
  ipl2025Count: number;
  ipl2024Avg: number;
  ipl2024Count: number;
  t20_2_5yrAvg: number;
  t20_2_5yrCount: number;
}

// weights = [last10-quality, leagueSeason2025, leagueSeason2024, allQuality30mo].
// Default (IPL/MLC/women) = [0.40,0.30,0.10,0.20]. A bilateral series has NO league
// season, so it passes [0.60,0,0,0.40] — recent-form-heavy, season buckets dropped.
function computeScore1(
  data: Score1Data,
  weights: number[] = [0.40, 0.30, 0.10, 0.20]
): number {
  const sources: Array<{ weight: number; avg: number; hasData: boolean }> = [
    { weight: weights[0], avg: data.last10Avg, hasData: data.last10Count > 0 },
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

// ==================== SCORE 2: Venue Conditions Factor ====================

function classifyVenues(): Map<string, VenueType> {
  const rows = sqlite
    .prepare(
      `SELECT mp.venue_name,
        AVG(CASE WHEN p.role IN ('BAT','WK') THEN mp.fantasy_points END) as bat_fp,
        AVG(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points END) as bowl_fp
      FROM match_performances mp
      JOIN players p ON mp.player_id = p.id
      WHERE mp.match_date >= '2020-01-01'
        AND mp.format IN ('IPL', 'T20')
        AND p.gender = 'male'
      GROUP BY mp.venue_name
      HAVING COUNT(DISTINCT mp.match_id) >= 3`
    )
    .all() as Array<{ venue_name: string; bat_fp: number; bowl_fp: number }>;

  const map = new Map<string, VenueType>();
  for (const r of rows) {
    if (!r.bat_fp || !r.bowl_fp) continue;
    const ratio = r.bat_fp / r.bowl_fp;
    if (ratio > 1.1) map.set(r.venue_name, "bat_road");
    else if (ratio >= 0.95) map.set(r.venue_name, "balanced");
    else map.set(r.venue_name, "bowl_friendly");
  }
  return map;
}

function getTeamSchedules(): Map<string, Array<{ venue: string; games: number }>> {
  // IPL 2026 Full League Stage Schedule (70 matches, 28 Mar – 24 May 2026)
  // Each entry: [team1, team2, venueDBName]
  const BEN = "M Chinnaswamy Stadium, Bengaluru";
  const MUM = "Wankhede Stadium, Mumbai";
  const CHE = "MA Chidambaram Stadium, Chepauk, Chennai";
  const KOL = "Eden Gardens, Kolkata";
  const DEL = "Arun Jaitley Stadium, Delhi";
  const AHM = "Narendra Modi Stadium, Ahmedabad";
  const HYD = "Rajiv Gandhi International Stadium, Uppal, Hyderabad";
  const LUC = "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow";
  const JAI = "Sawai Mansingh Stadium, Jaipur";
  const DHA = "Himachal Pradesh Cricket Association Stadium, Dharamsala";
  const RAI = "Shaheed Veer Narayan Singh International Stadium, Raipur";
  const GUW = "Barsapara Cricket Stadium, Guwahati";
  const NCH = "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur";

  const IPL_2026_SCHEDULE: Array<[string, string, string]> = [
    // Phase 1 (matches 1-20, 28 Mar – 12 Apr)
    ["RCB", "SRH", BEN],  ["MI",  "KKR", MUM],  ["RR",  "CSK", GUW],
    ["PBKS","GT",  NCH],   ["LSG", "DC",  LUC],  ["KKR", "SRH", KOL],
    ["CSK", "PBKS",CHE],   ["DC",  "MI",  DEL],  ["GT",  "RR",  AHM],
    ["SRH", "LSG", HYD],   ["RCB", "CSK", BEN],  ["KKR", "PBKS",KOL],
    ["RR",  "MI",  GUW],   ["DC",  "GT",  DEL],  ["KKR", "LSG", KOL],
    ["RR",  "RCB", GUW],   ["PBKS","SRH", NCH],  ["CSK", "DC",  CHE],
    ["LSG", "GT",  LUC],   ["MI",  "RCB", MUM],
    // Phase 2 (matches 21-70, 13 Apr – 24 May)
    ["SRH", "RR",  HYD],   ["MI",  "CSK", MUM],  ["SRH", "RCB", BEN],
    ["MI",  "GT",  MUM],   ["CSK", "RCB", BEN],  ["RCB", "RR",  KOL],
    ["SRH", "KKR", NCH],   ["GT",  "PBKS",AHM],  ["KKR", "LSG", HYD],
    ["PBKS","MI",  NCH],   ["SRH", "MI",  HYD],  ["CSK", "RR",  CHE],
    ["RCB", "KKR", BEN],   ["DC",  "PBKS",DEL],  ["GT",  "CSK", AHM],
    ["LSG", "SRH", LUC],   ["MI",  "RCB", MUM],  ["RR",  "DC",  JAI],
    ["KKR", "GT",  KOL],   ["PBKS","LSG", NCH],  ["SRH", "CSK", HYD],
    ["RR",  "MI",  JAI],   ["RCB", "DC",  BEN],  ["GT",  "PBKS",AHM],
    ["KKR", "LSG", KOL],   ["CSK", "MI",  CHE],  ["SRH", "RCB", HYD],
    ["DC",  "RR",  DEL],   ["LSG", "KKR", LUC],  ["PBKS","GT",  DHA],
    ["MI",  "SRH", MUM],   ["CSK", "DC",  CHE],  ["RR",  "PBKS",JAI],
    ["RCB", "GT",  RAI],   ["LSG", "MI",  LUC],  ["KKR", "SRH", KOL],
    ["DC",  "RCB", DEL],   ["GT",  "RR",  AHM],  ["PBKS","CSK", DHA],
    ["MI",  "KKR", MUM],   ["SRH", "LSG", HYD],  ["RCB", "PBKS",RAI],
    ["CSK", "GT",  CHE],   ["RR",  "KKR", JAI],  ["DC",  "LSG", DEL],
    ["MI",  "GT",  MUM],   ["SRH", "PBKS",HYD],  ["SRH", "RCB", HYD],
    ["LSG", "PBKS",LUC],   ["MI",  "RR",  MUM],  ["KKR", "DC",  KOL],
  ];

  // Build venue-grouped schedules per team
  const teamVenueCount = new Map<string, Map<string, number>>();
  for (const [t1, t2, venue] of IPL_2026_SCHEDULE) {
    for (const team of [t1, t2]) {
      if (!teamVenueCount.has(team)) teamVenueCount.set(team, new Map());
      const vc = teamVenueCount.get(team)!;
      vc.set(venue, (vc.get(venue) || 0) + 1);
    }
  }

  const schedules = new Map<string, Array<{ venue: string; games: number }>>();
  for (const [team, venueMap] of teamVenueCount) {
    schedules.set(
      team,
      Array.from(venueMap.entries()).map(([venue, games]) => ({ venue, games }))
    );
  }
  return schedules;
}

function batchPlayerVenueFP(
  playerIds: number[],
  formats: readonly string[] = ["IPL", "T20"],
  windowMonths = 30
): Map<number, Map<string, { avg: number; cnt: number }>> {
  if (playerIds.length === 0) return new Map();

  const placeholders = playerIds.map(() => "?").join(",");
  const fmtIn = formats.map((f) => `'${f}'`).join(",");
  const rows = sqlite
    .prepare(
      `SELECT player_id, venue_name, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format IN (${fmtIn})
         AND match_date >= date('now', '-${windowMonths} months')
       GROUP BY player_id, venue_name`
    )
    .all(...playerIds) as Array<{
    player_id: number;
    venue_name: string;
    avg_fp: number;
    cnt: number;
  }>;

  const map = new Map<number, Map<string, { avg: number; cnt: number }>>();
  for (const r of rows) {
    if (!map.has(r.player_id)) map.set(r.player_id, new Map());
    map.get(r.player_id)!.set(r.venue_name, { avg: r.avg_fp, cnt: r.cnt });
  }
  return map;
}

function batchPlayerVenueTypeFP(
  playerIds: number[],
  venueClassification: Map<string, VenueType>,
  formats: readonly string[] = ["IPL", "T20"],
  windowMonths = 30
): Map<number, Map<VenueType, { avg: number; cnt: number }>> {
  if (playerIds.length === 0) return new Map();

  const placeholders = playerIds.map(() => "?").join(",");
  const fmtIn = formats.map((f) => `'${f}'`).join(",");
  const rows = sqlite
    .prepare(
      `SELECT player_id, venue_name, fantasy_points
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format IN (${fmtIn})
         AND match_date >= date('now', '-${windowMonths} months')`
    )
    .all(...playerIds) as Array<{
    player_id: number;
    venue_name: string;
    fantasy_points: number;
  }>;

  // Aggregate by player × venue_type
  const accum = new Map<
    number,
    Map<VenueType, { total: number; cnt: number }>
  >();
  for (const r of rows) {
    const vt = venueClassification.get(r.venue_name);
    if (!vt) continue;

    if (!accum.has(r.player_id)) accum.set(r.player_id, new Map());
    const playerMap = accum.get(r.player_id)!;
    if (!playerMap.has(vt)) playerMap.set(vt, { total: 0, cnt: 0 });
    const entry = playerMap.get(vt)!;
    entry.total += r.fantasy_points;
    entry.cnt += 1;
  }

  const result = new Map<
    number,
    Map<VenueType, { avg: number; cnt: number }>
  >();
  for (const [pid, vtMap] of accum) {
    const rMap = new Map<VenueType, { avg: number; cnt: number }>();
    for (const [vt, data] of vtMap) {
      rMap.set(vt, { avg: data.total / data.cnt, cnt: data.cnt });
    }
    result.set(pid, rMap);
  }
  return result;
}

function computeConditionsFactor(
  playerId: number,
  overallFP: number,
  teamSchedule: Array<{ venue: string; games: number }>,
  playerVenueFP: Map<string, { avg: number; cnt: number }> | undefined,
  playerVenueTypeFP: Map<VenueType, { avg: number; cnt: number }> | undefined,
  venueClassification: Map<string, VenueType>
): number {
  if (!teamSchedule || teamSchedule.length === 0 || overallFP <= 0) return 1.0;

  let totalGames = 0;
  let weightedFP = 0;

  for (const { venue, games } of teamSchedule) {
    totalGames += games;

    // Try venue-specific FP (blended with overall — venue never fully overrides)
    const venueStat = playerVenueFP?.get(venue);
    if (venueStat && venueStat.cnt >= 5) {
      const confidence = Math.min(venueStat.cnt / 10, 0.5);
      const blended = confidence * venueStat.avg + (1 - confidence) * overallFP;
      weightedFP += blended * games;
      continue;
    }

    // Fallback: venue type FP (blended with overall)
    const venueType = venueClassification.get(venue);
    if (venueType) {
      const vtStat = playerVenueTypeFP?.get(venueType);
      if (vtStat && vtStat.cnt >= 5) {
        const confidence = Math.min(vtStat.cnt / 10, 0.5);
        const blended = confidence * vtStat.avg + (1 - confidence) * overallFP;
        weightedFP += blended * games;
        continue;
      }
    }

    // Final fallback: overall FP (no adjustment for this venue)
    weightedFP += overallFP * games;
  }

  if (totalGames === 0) return 1.0;
  const scheduleFP = weightedFP / totalGames;
  return scheduleFP / overallFP;
}

// ==================== MAIN VALUATION ====================

export function recalculateValuations(
  tournamentId: number | string,
  auctionId?: number | string
) {
  // --- Auction config ---
  const auctionQuery = auctionId
    ? sqlite
        .prepare(
          "SELECT purse_per_friend, num_friends, players_per_friend, num_captains, num_vice_captains, changes_allowed FROM auctions WHERE id = ?"
        )
        .get(auctionId)
    : sqlite
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
  const tournamentRow = sqlite
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
  // For MLC, the "primary league season" buckets are MLC (not IPL), and the quality pool is
  // MLC + IPL + T20I (vs WPL for the women's path). A bilateral T20I series has NO league
  // season: Score 1 drops the season buckets, weights Last-10 60% + all-quality-30mo 40%.
  // The Hundred is a franchise league scored on its OWN scale ('HUN'): league season = HUN
  // 2025/2024; quality = HUN + T20/IPL/MLC (men) or HUN + WPL + women's-T20 (women); the
  // non-Hundred proxy form is normalized to the Hundred scale per role (normMult below).
  // LPL: venue ON — all 2026 grounds read bowl_friendly on LPL+SL-T20I history (subcontinent);
  // venueClassification + per-team schedule overridden in the isLpl block below.
  const leagueFmt = isHundred ? "HUN" : isMLC ? "MLC" : isLpl ? "LPL" : "IPL";
  const qualityList = isHundredMen
    ? "'HUN','T20','IPL','MLC'"
    : isHundredWomen
    ? "'HUN','WPL','T20'"
    : isLpl
    ? "'LPL','IPL'"
    : isMLC || isBilateral
    ? "'MLC','IPL'"
    : "'IPL','WPL'";
  // Bilateral (T20I) AND both ODI archetypes have no league season → recent-form-heavy.
  const score1Weights =
    isBilateral || isWomensOdi || isMensOdi ? [0.60, 0, 0, 0.40] : undefined;

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
  const pool = sqlite
    .prepare(
      `SELECT ap.id, ap.player_id, ap.status, ap.squad_number, ap.ipl_team, p.role, COALESCE(ap.price_manual, 0) as price_manual, COALESCE(ap.efppm, 0) as efppm, COALESCE(ap.sold_price, 0) as sold_price
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
  const qualityClause = isWomensOdi
    ? `format = 'ODI'`
    : isMensOdi
    ? `format = 'ODI' AND opposition IN (${top8Placeholders})`
    : `format IN (${qualityList}) OR (format = 'T20' AND opposition IN (${top8Placeholders}))`;
  // women's ODI binds no extra params; men's ODI + T20 both bind the top-8 nation list.
  const qualityParams = isWomensOdi ? [] : TOP_8_NATIONS;
  const last10Window = isWomensOdi ? "-48 months" : isMensOdi ? "-36 months" : "-24 months";
  const allWindow = isWomensOdi || isMensOdi ? "-36 months" : "-30 months";

  // --- Batch Query: Score 1 sources ---

  // A: Last 10 quality T20 matches per player
  const last10Rows = sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM (
         SELECT player_id, fantasy_points,
           ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY match_date DESC) as rn
         FROM match_performances
         WHERE player_id IN (${placeholders})
           AND (${qualityClause})
           AND match_date >= date('now', '${last10Window}')
       )
       WHERE rn <= 10
       GROUP BY player_id`
    )
    .all(...playerIds, ...qualityParams) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const last10Map = new Map(last10Rows.map((r) => [r.player_id, r]));

  // B: IPL 2025 avg FP
  const ipl2025Rows = sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format = '${leagueFmt}' AND match_date >= '2025-01-01' AND match_date < '2026-01-01'
       GROUP BY player_id`
    )
    .all(...playerIds) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const ipl2025Map = new Map(ipl2025Rows.map((r) => [r.player_id, r]));

  // C: IPL 2024 avg FP
  const ipl2024Rows = sqlite
    .prepare(
      `SELECT player_id, AVG(fantasy_points) as avg_fp, COUNT(*) as cnt
       FROM match_performances
       WHERE player_id IN (${placeholders})
         AND format = '${leagueFmt}' AND match_date >= '2024-01-01' AND match_date < '2025-01-01'
       GROUP BY player_id`
    )
    .all(...playerIds) as Array<{
    player_id: number;
    avg_fp: number;
    cnt: number;
  }>;
  const ipl2024Map = new Map(ipl2024Rows.map((r) => [r.player_id, r]));

  // D: All quality T20 last 2.5yr
  const t20AllRows = sqlite
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
  if (isHundred) {
    const hunFracRows = sqlite
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

  // --- Batch Query: Score 2 data ---
  const venueClassification = classifyVenues();
  let teamSchedules = getTeamSchedules();
  if (isHundred) {
    // Override the 8 English grounds' classification (consolidated men's bat/bowl read) and
    // build each team's 8-game schedule: home ground x4 + the other 7 grounds spread (~4/7).
    for (const v of HUNDRED_VENUES) {
      for (const variant of v.variants) venueClassification.set(variant, v.type);
    }
    const grounds = HUNDRED_VENUES.map((v) => v.canonical);
    teamSchedules = new Map(
      HUNDRED_MEN_2026.map((t) => {
        const away = grounds
          .filter((g) => g !== t.home)
          .map((g) => ({ venue: g, games: 4 / 7 }));
        return [t.short, [{ venue: t.home, games: 4 }, ...away]];
      })
    );
  }
  if (isBilateral) {
    // Bilateral: each side plays all 5 series grounds once. (a) Override the 5 grounds'
    // classification with the consolidated, full-history, men's-only bat/bowl read —
    // classifyVenues fragments cricsheet's renamed variants + thin-samples them; set BOTH
    // spellings so a player's history under either buckets into the right venue type.
    // (b) Replace the IPL-keyed schedule with a 5-ground one keyed by IND/ENG.
    for (const v of IND_VS_ENG_VENUES) {
      for (const variant of v.variants) venueClassification.set(variant, v.type);
    }
    const ground5 = IND_VS_ENG_VENUES.map((v) => ({ venue: v.canonical, games: 1 }));
    teamSchedules = new Map(IND_VS_ENG_T20_2026.map((t) => [t.short, ground5]));
  }
  if (isMensOdi) {
    // Men's ODI: both sides play all 5 ODIs at 2 Caribbean grounds (Providence x3, Kensington
    // x2), both bowl_friendly on men's ODI bat/bowl history. Set both name variants so a
    // player's ODI history under either spelling buckets into the right venue type.
    for (const v of NZ_WI_MEN_ODI_VENUES) {
      for (const variant of v.variants) venueClassification.set(variant, v.type);
    }
    const grounds = [
      { venue: NZ_WI_MEN_ODI_VENUES[0].canonical, games: 3 },
      { venue: NZ_WI_MEN_ODI_VENUES[1].canonical, games: 2 },
    ];
    teamSchedules = new Map(NZ_VS_WI_MEN_ODI_2026.map((t) => [t.short, grounds]));
  }
  if (isLpl) {
    // LPL: all 3 league venues (SSC / Dambulla / Pallekele) read bowl_friendly on LPL+SL-T20I
    // history — set every cricsheet name variant so a player's ground history buckets correctly.
    // Replace the IPL-keyed schedule with each franchise's actual 8-game venue split.
    for (const v of LPL_VENUES) {
      for (const variant of v.variants) venueClassification.set(variant, v.type);
    }
    teamSchedules = new Map(Object.entries(LPL_TEAM_SCHEDULE));
  }
  // Men's ODI reads venue history from ODI matches (wider window — fewer ODIs per ground);
  // LPL reads its own league + SL-T20I ground history over a wider (60mo) window (5 seasons,
  // 2020–2024); every other tour keeps the T20-family default (byte-identical).
  const venueFormats = isMensOdi ? ["ODI"] : isLpl ? ["LPL", "T20"] : ["IPL", "T20"];
  const venueWindow = isMensOdi ? 60 : isLpl ? 60 : 30;
  const playerVenueFP = batchPlayerVenueFP(playerIds, venueFormats, venueWindow);
  const playerVenueTypeFP = batchPlayerVenueTypeFP(
    playerIds,
    venueClassification,
    venueFormats,
    venueWindow
  );

  // --- Batch Query: Bowling overs avg ---
  const bowlOversRows = sqlite
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
  const ceilingRows = sqlite
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

  for (const p of availPool) {
    // Score 1
    const last10 = last10Map.get(p.player_id);
    const ipl2025 = ipl2025Map.get(p.player_id);
    const ipl2024 = ipl2024Map.get(p.player_id);
    const t20All = t20AllMap.get(p.player_id);

    const rawScore1 = computeScore1({
      last10Avg: last10?.avg_fp ?? 0,
      last10Count: last10?.cnt ?? 0,
      ipl2025Avg: ipl2025?.avg_fp ?? 0,
      ipl2025Count: ipl2025?.cnt ?? 0,
      ipl2024Avg: ipl2024?.avg_fp ?? 0,
      ipl2024Count: ipl2024?.cnt ?? 0,
      t20_2_5yrAvg: t20All?.avg_fp ?? 0,
      t20_2_5yrCount: t20All?.cnt ?? 0,
    }, score1Weights);

    // Hundred small-sample shrinkage (empirical-Bayes: k=5 pseudo-games toward a prior of 40).
    // Regresses the form estimate when a player has few quality games, so thin-sample fliers
    // (e.g. an uncapped bowler with ~0 Hundred games) don't top the board; large-n players
    // (Rashid/Buttler/Marsh) barely move. Hundred-only; all other tours use the raw estimate.
    const score1 = isHundred
      ? ((qualNMap.get(p.player_id) ?? 0) * rawScore1 + 5 * 40) /
        ((qualNMap.get(p.player_id) ?? 0) + 5)
      : rawScore1;

    // Hundred: convert the (mostly non-Hundred) proxy form to the D11 Hundred scale, weighted
    // by how much of the player's recent quality history is actually Hundred. normMult=1 else.
    let normMult = 1.0;
    if (isHundred) {
      const hf = hunFracMap.get(p.player_id) ?? 0;
      const rf = HUNDRED_ROLE_NORM[p.role as HundredRole] ?? 1.0;
      normMult = hf + (1 - hf) * rf;
    }
    const normScore1 = score1 * normMult;

    // Score 2: conditions factor. The venue multiplier is a scale-invariant ratio, so compute
    // it from the raw score1, then apply it to the normalized score1.
    const schedule = teamSchedules.get(p.ipl_team);
    const conditionsFactor = computeConditionsFactor(
      p.player_id,
      score1,
      schedule ?? [],
      playerVenueFP.get(p.player_id),
      playerVenueTypeFP.get(p.player_id),
      venueClassification
    );

    const finalEfppm = normScore1 * conditionsFactor;
    const expectedMatches = isHundred
      ? hundredExpectedMatches(p.ipl_team, p.squad_number, isHundredWomen)
      : isBilateral
      ? bilateralExpectedMatches(p.squad_number)
      : isWomensOdi
      ? odiExpectedMatches(p.squad_number)
      : isMensOdi
      ? mensOdiExpectedMatches(p.squad_number)
      : isMLC
      ? mlcExpectedMatches(p.ipl_team, p.squad_number)
      : isLpl
      ? lplExpectedMatches(p.squad_number)
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
  const updateStmt = sqlite.prepare(`
    UPDATE auction_pool
    SET efppm = ?, val_floor = ?, val_expected = ?, val_ceiling = ?, bowl_overs_avg = ?
    WHERE id = ?
  `);

  // Build set of manually-priced pool IDs so we skip their price columns
  const manualIds = new Set(pool.filter((p) => p.price_manual === 1).map((p) => p.id));

  const updateManualStmt = sqlite.prepare(`
    UPDATE auction_pool
    SET efppm = ?, bowl_overs_avg = ?
    WHERE id = ?
  `);

  const transaction = sqlite.transaction(() => {
    for (const v of results) {
      if (manualIds.has(v.id)) {
        // Only update EFPPM + bowling overs, preserve user's manual price
        updateManualStmt.run(
          Math.round(v.efppm * 100) / 100,
          v.bowlOversAvg !== null ? Math.round(v.bowlOversAvg * 10) / 10 : null,
          v.id
        );
      } else {
        const price = priceMap.get(v.id)!;
        updateStmt.run(
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
  transaction();
}

export function initializeValuations(
  tournamentId: number | string,
  auctionId?: number | string
) {
  recalculateValuations(tournamentId, auctionId);
  sqlite
    .prepare("UPDATE tournaments SET status = 'AUCTION' WHERE id = ?")
    .run(tournamentId);
}
