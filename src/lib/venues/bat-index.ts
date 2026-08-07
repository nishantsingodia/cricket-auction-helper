// ============================================================================
// BAT INDEX — how much a ground favours batting. REPORTING ONLY.
// ============================================================================
//
// This never touches a price. Venue adjustments were removed from the valuation engine on
// 5 Aug 2026 by decision: measured honestly (leave-one-out, so a player is excluded from the ground
// average he is scored against) the real venue elasticity is only about +0.21 for batters and −0.23
// for bowlers — roughly a 2% effect, against 30–50% for overseas availability and ~6% for the
// milestone scoring bug. Not worth the machinery. So the venue work survives purely as information:
// tell me which grounds favour bat or ball, and by how much, and let me judge it myself.
//
// DEFINITION:  batIndex = avg batting FP ÷ avg bowling FP at that ground.
//
// Why the RATIO and not "this ground's scoring vs the league average": fantasy points are not
// zero-sum between disciplines. A high-action ground (short boundaries, collapses → lots of runs AND
// lots of wickets) inflates BOTH sides, so a per-discipline level factor mostly measures how much
// total scoring happens there, not pitch character. Dividing cancels that common term. An earlier
// level-based attempt had to be reverted for exactly this reason: batting and bowling factors came
// out on the SAME side of neutral at our two best-sampled grounds, which is impossible as "character".
//
// SAMPLE RULE (chosen deliberately — prefer recent, widen only when thin):
//   last 2 years  if the ground has >= 15 matches   ->  freshest usable read
//   else last 4 years if it has >= 5 matches        ->  fall back for low-usage grounds
//   else 1.0 (neutral)                              ->  we genuinely do not know
//
// Caveats worth remembering when reading the number:
//   * The league median is ~0.90, NOT 1.0 — bowlers simply earn more fantasy points than batters
//     because a wicket is 30. So compare a ground to the median, never to 1.0.
//   * Vitality Blast is excluded, so English grounds read on internationals + The Hundred only.
//   * A 5-match read is not a strong read. `matches` is returned so thin numbers can be discounted.

import { sqlite } from "@/db";
import { canonicalVenue } from "@/lib/registry/venues";

export const BAT_INDEX_FORMATS = [
  "CPL", "IPL", "BBL", "PSL", "LPL", "SA20", "ILT20", "MLC", "HUN", "T20",
] as const;

const RECENT_MONTHS = 24;
const RECENT_MIN_MATCHES = 15;
const WIDE_MONTHS = 48;
const WIDE_MIN_MATCHES = 5;

export type BatIndexSource = "2yr" | "4yr" | "neutral";

export interface BatIndexEntry {
  ground: string; // canonical ground name
  batIndex: number; // >median = favours batting, <median = favours bowling
  matches: number; // sample behind the number — discount thin reads
  source: BatIndexSource;
  batFp: number | null;
  bowlFp: number | null;
}

interface Row {
  ground: string;
  bat_sum: number; bat_n: number; bowl_sum: number; bowl_n: number; matches: number;
}

// SUM + COUNT per RAW spelling, then folded onto the canonical ground — cricsheet stores one ground
// under up to four names, so averaging per raw string measures each ground on a fragment of its
// history (see src/lib/registry/venues.ts).
//
// PERF: both windows are read by ONE query (one network round-trip) instead of two. The 24-month set
// is a strict SUBSET of the 48-month set, so we scan the wide window once and split the aggregates
// with CASE. This is exact, not an approximation: every aggregate is SUM / COUNT(DISTINCT) — no AVG
// is being merged (which would NOT fold) — and `fantasy_points` holds whole numbers, so the sums are
// bit-identical to the two separate queries this replaces. A raw spelling with no rows inside the
// 24-month window is skipped for `recent`, so that map has exactly the same keys it had before.
async function readWindows(
  gender: "male" | "female"
): Promise<{ recent: Map<string, Row>; wide: Map<string, Row> }> {
  const fmt = BAT_INDEX_FORMATS.map((f) => `'${f}'`).join(",");
  const inWindow = (months: number) => `mp.match_date >= date('now', '-${months} months')`;
  // NOTE the inner CASE keeps the original `WHEN p.role = 'BOWL' THEN … ELSE …` shape rather than
  // `p.role != 'BOWL'`: role can be NULL, and a NULL role must keep landing on the BATTING side.
  const cols = (prefix: string, months: number) => `
         SUM(CASE WHEN ${inWindow(months)} THEN (CASE WHEN p.role = 'BOWL' THEN 0 ELSE mp.fantasy_points END) ELSE 0 END) AS ${prefix}bat_sum,
         SUM(CASE WHEN ${inWindow(months)} THEN (CASE WHEN p.role = 'BOWL' THEN 0 ELSE 1 END) ELSE 0 END) AS ${prefix}bat_n,
         SUM(CASE WHEN ${inWindow(months)} THEN (CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points ELSE 0 END) ELSE 0 END) AS ${prefix}bowl_sum,
         SUM(CASE WHEN ${inWindow(months)} THEN (CASE WHEN p.role = 'BOWL' THEN 1 ELSE 0 END) ELSE 0 END) AS ${prefix}bowl_n,
         COUNT(DISTINCT CASE WHEN ${inWindow(months)} THEN mp.match_id END) AS ${prefix}matches`;

  const rows = await sqlite
    .prepare(
      `SELECT mp.venue_name AS venue,
${cols("r_", RECENT_MONTHS)},
${cols("w_", WIDE_MONTHS)}
       FROM match_performances mp
       JOIN players p ON p.id = mp.player_id
       WHERE mp.format IN (${fmt})
         AND mp.venue_name IS NOT NULL
         AND mp.fantasy_points IS NOT NULL
         AND mp.match_date >= date('now', '-${WIDE_MONTHS} months')
         AND ${gender === "female" ? "p.gender = 'female'" : "(p.gender != 'female' OR p.gender IS NULL)"}
       GROUP BY mp.venue_name`
    )
    .all() as Array<{
    venue: string;
    r_bat_sum: number; r_bat_n: number; r_bowl_sum: number; r_bowl_n: number; r_matches: number;
    w_bat_sum: number; w_bat_n: number; w_bowl_sum: number; w_bowl_n: number; w_matches: number;
  }>;

  const fold = (
    out: Map<string, Row>,
    g: string,
    bat_sum: number, bat_n: number, bowl_sum: number, bowl_n: number, matches: number
  ) => {
    const cur = out.get(g) ?? { ground: g, bat_sum: 0, bat_n: 0, bowl_sum: 0, bowl_n: 0, matches: 0 };
    cur.bat_sum += bat_sum; cur.bat_n += bat_n;
    cur.bowl_sum += bowl_sum; cur.bowl_n += bowl_n; cur.matches += matches;
    out.set(g, cur);
  };

  const recent = new Map<string, Row>();
  const wide = new Map<string, Row>();
  for (const r of rows) {
    const g = canonicalVenue(r.venue);
    if (r.r_matches > 0) fold(recent, g, r.r_bat_sum, r.r_bat_n, r.r_bowl_sum, r.r_bowl_n, r.r_matches);
    fold(wide, g, r.w_bat_sum, r.w_bat_n, r.w_bowl_sum, r.w_bowl_n, r.w_matches);
  }
  return { recent, wide };
}

const ratioOf = (r: Row | undefined) =>
  r && r.bat_n > 0 && r.bowl_n > 0 && r.bowl_sum > 0
    ? { idx: (r.bat_sum / r.bat_n) / (r.bowl_sum / r.bowl_n), bat: r.bat_sum / r.bat_n, bowl: r.bowl_sum / r.bowl_n }
    : null;

/** Bat Index for every ground we have a usable sample for, plus the league median for comparison. */
type BatIndexResult = { byGround: Map<string, BatIndexEntry>; median: number };

// The Bat Index sweeps four years of match_performances across EVERY ground — the league median it
// compares against is only meaningful over the whole set, so it cannot be narrowed to one tour. That
// is ~370k rows read per call, and it is reached by /api/venues, /api/players/[id]?tour= and the
// board's own /api/auction/[id]. Against a local file that was free; against Turso, which bills rows
// read, it was the single largest consumer on the account.
//
// It is derived PURELY from reference data (match_performances + players), which only changes when
// the ETL runs on the laptop and the result is pushed. So it is safe to memoise per process. The TTL
// exists only so a `turso:push` is picked up without waiting for the lambda to recycle.
const BAT_INDEX_TTL_MS = 10 * 60 * 1000;
const batIndexCache = new Map<string, { at: number; value: BatIndexResult }>();

// Second tier: a PERSISTED cache, because the in-process memo only helps a warm lambda and a cold
// one paid the full ~370k-row sweep again. Written once on first compute, then read as ~200 rows.
// It is invalidated by construction: `turso:push` clears this table in the snapshot it uploads, so a
// refreshed match_performances can never be served against a stale index.
const BAT_INDEX_TABLE = `CREATE TABLE IF NOT EXISTS bat_index_cache (
  gender TEXT NOT NULL, ground TEXT NOT NULL, bat_index REAL NOT NULL, matches INTEGER NOT NULL,
  source TEXT NOT NULL, bat_fp REAL, bowl_fp REAL, median REAL NOT NULL,
  PRIMARY KEY (gender, ground)
)`;

async function readPersisted(gender: string): Promise<BatIndexResult | null> {
  try {
    const rows = (await sqlite
      .prepare(
        `SELECT ground, bat_index, matches, source, bat_fp, bowl_fp, median
           FROM bat_index_cache WHERE gender = ?`
      )
      .all(gender)) as Array<{
      ground: string; bat_index: number; matches: number; source: string;
      bat_fp: number | null; bowl_fp: number | null; median: number;
    }>;
    if (!rows.length) return null;
    const byGround = new Map<string, BatIndexEntry>();
    for (const r of rows) {
      byGround.set(r.ground, {
        ground: r.ground, batIndex: r.bat_index, matches: r.matches,
        source: r.source as BatIndexEntry["source"], batFp: r.bat_fp, bowlFp: r.bowl_fp,
      });
    }
    return { byGround, median: rows[0].median };
  } catch {
    return null; // table not there yet — fall through and compute
  }
}

async function writePersisted(gender: string, res: BatIndexResult): Promise<void> {
  try {
    await sqlite.prepare(BAT_INDEX_TABLE).run();
    await sqlite.prepare(`DELETE FROM bat_index_cache WHERE gender = ?`).run(gender);
    const ins = sqlite.prepare(
      `INSERT OR REPLACE INTO bat_index_cache
         (gender, ground, bat_index, matches, source, bat_fp, bowl_fp, median)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of res.byGround.values()) {
      await ins.run(gender, e.ground, e.batIndex, e.matches, e.source, e.batFp, e.bowlFp, res.median);
    }
  } catch {
    // Caching is an optimisation, never a correctness requirement — a read-only replica or a
    // migration in flight must not take the venue model down.
  }
}

export async function computeBatIndex(gender: "male" | "female" = "male"): Promise<BatIndexResult> {
  const memo = batIndexCache.get(gender);
  if (memo && Date.now() - memo.at < BAT_INDEX_TTL_MS) return memo.value;

  const persisted = await readPersisted(gender);
  if (persisted) {
    batIndexCache.set(gender, { at: Date.now(), value: persisted });
    return persisted;
  }

  const fresh = await computeBatIndexUncached(gender);
  batIndexCache.set(gender, { at: Date.now(), value: fresh });
  await writePersisted(gender, fresh);
  return fresh;
}

async function computeBatIndexUncached(gender: "male" | "female"): Promise<BatIndexResult> {
  // Both windows come back from a single query — see readWindows().
  const { recent, wide } = await readWindows(gender);

  const byGround = new Map<string, BatIndexEntry>();
  for (const ground of new Set([...recent.keys(), ...wide.keys()])) {
    const r = recent.get(ground);
    const w = wide.get(ground);
    const rr = ratioOf(r);
    const wr = ratioOf(w);

    if (r && rr && r.matches >= RECENT_MIN_MATCHES) {
      byGround.set(ground, { ground, batIndex: rr.idx, matches: r.matches, source: "2yr", batFp: rr.bat, bowlFp: rr.bowl });
    } else if (w && wr && w.matches >= WIDE_MIN_MATCHES) {
      byGround.set(ground, { ground, batIndex: wr.idx, matches: w.matches, source: "4yr", batFp: wr.bat, bowlFp: wr.bowl });
    } else {
      byGround.set(ground, {
        ground, batIndex: 1.0, matches: w?.matches ?? r?.matches ?? 0,
        source: "neutral", batFp: null, bowlFp: null,
      });
    }
  }

  const real = [...byGround.values()].filter((e) => e.source !== "neutral").map((e) => e.batIndex).sort((a, b) => a - b);
  const median = real.length ? real[Math.floor(real.length / 2)] : 1.0;
  return { byGround, median };
}

/**
 * Venue character from the measured index, calibrated against the MEDIAN (~0.906) rather than 1.0.
 *
 * This matters: the app's original thresholds (>1.10 bat_road, >=0.95 balanced) were centred on 1.0,
 * but bowlers out-earn batters at 76% of grounds because a wicket is 30 points — so a perfectly
 * ordinary ground scores ~0.906 and got labelled "bowl_friendly". That mis-calibration had 5 of the
 * 8 CPL grounds wrong, including Warner Park (our best-sampled Caribbean ground) called
 * bowl_friendly when batters actually out-earn bowlers there.
 */
export function venueTypeFromBatIndex(
  batIndex: number,
  _median: number
): "bat_road" | "balanced" | "bowl_friendly" {
  // ABSOLUTE reading, deliberately: the label answers "who actually scores more here?", because
  // that is what "bowl-friendly" means to anyone reading a cricket app. batIndex is
  // battingFP/bowlingFP, so 0.90 means bowlers earn 1/0.90 = 11% more and the honest label is
  // bowl_friendly — even though 0.90 is also the league MEDIAN.
  //
  // The consequence is accepted knowingly: ~76% of grounds come out bowl_friendly, so this label
  // does NOT tell you a ground is unusual. That is what the separate relative reading is for
  // (`favours`/`pct` from describeBatIndex, shown as a second line). One three-way label cannot
  // carry both questions, and an earlier attempt to make it carry the relative one produced the
  // absurdity of Providence — where bowlers earn 13% more — being displayed as "Balanced".
  //
  // Bands are +/-5% around parity, i.e. under a 5% edge either way is genuinely even-handed.
  if (batIndex > 1.05) return "bat_road";
  if (batIndex >= 0.95) return "balanced";
  return "bowl_friendly";
}

/**
 * Two readings of the same number, because they answer different questions and can disagree.
 *
 * ABSOLUTE (`whoEarnsMore`) — at this ground, does a batter or a bowler bank more fantasy points?
 *   Index 0.90 means bowlers out-earn batters by ~11%, and that is genuinely actionable. It is also
 *   true at 76% of grounds: one wicket is 30 points, so wickets alone give the average bowler ~31 of
 *   his ~48 points. The gap is mostly the SCORING SYSTEM, not the pitch — it holds across nearly
 *   every league (BBL 0.87, T20I 0.89, SA20 0.92, LPL 0.96, MLC 0.98, PSL 0.98, CPL 1.00). The IPL
 *   is the notable exception at 1.12, where flat decks put batters ahead.
 *
 * RELATIVE (`vsAverage`) — is this ground UNUSUAL for bat or ball? Only meaningful against the
 *   median (~0.905), since "bowlers earn more" describes almost everywhere and so distinguishes
 *   nothing on its own.
 *
 * Report both. The grounds worth noticing are the ones where the two disagree — e.g. Providence at
 * 0.886 pays bowlers more in absolute terms yet is completely ordinary for a ground.
 */
export function describeBatIndex(batIndex: number, median: number): {
  favours: "batting" | "bowling" | "neutral"; // relative to other grounds
  pct: number; // distance from the median, %
  whoEarnsMore: "batters" | "bowlers"; // absolute, at this ground
  earnsMorePct: number; // by how much, %
  label: string; // relative reading
  absoluteLabel: string; // absolute reading
} {
  const rel = batIndex / median - 1;
  const pct = Math.round(Math.abs(rel) * 100);
  const batAhead = batIndex >= 1;
  const earnsMorePct = Math.round(Math.abs(batAhead ? batIndex - 1 : 1 / batIndex - 1) * 100);
  const absoluteLabel = batAhead
    ? `Batters earn ${earnsMorePct}% more here`
    : `Bowlers earn ${earnsMorePct}% more here`;

  // PRIMARY label = the absolute reading (who scores more here). SECONDARY = how it compares to
  // other grounds. Primary first because "bowlers earn 13% more here" is the fact you act on.
  const relLabel =
    pct < 3
      ? "typical for a ground"
      : rel > 0
      ? `${pct}% more batting-friendly than average`
      : `${pct}% more bowling-friendly than average`;
  const label = `${absoluteLabel} — ${relLabel}`;

  return {
    favours: pct < 3 ? "neutral" : rel > 0 ? "batting" : "bowling",
    pct,
    whoEarnsMore: batAhead ? "batters" : "bowlers",
    earnsMorePct,
    label,
    absoluteLabel,
  };
}

// ============================================================================
// Per-team venue mix — how many of a team's games fall on each type of ground.
// ============================================================================
// Reporting only. Uses the DERIVED (measured) type, not any hand-typed value, and the ABSOLUTE
// calibration — so "bowl_friendly" here means bowlers genuinely out-earn batters at that ground.
export interface TeamVenueMix {
  team: string;
  games: number;
  batRoad: number;
  balanced: number;
  bowlFriendly: number;
  unknown: number; // grounds with no usable sample
}

export async function teamVenueMix(
  teamSchedule: Record<string, Array<{ venue: string; games: number }>>,
  gender: "male" | "female" = "male"
): Promise<TeamVenueMix[]> {
  const { byGround, median } = await computeBatIndex(gender);
  const out: TeamVenueMix[] = [];
  for (const [team, sched] of Object.entries(teamSchedule)) {
    const m: TeamVenueMix = { team, games: 0, batRoad: 0, balanced: 0, bowlFriendly: 0, unknown: 0 };
    for (const { venue, games } of sched) {
      m.games += games;
      const e = byGround.get(canonicalVenue(venue));
      if (!e || e.source === "neutral") { m.unknown += games; continue; }
      const t = venueTypeFromBatIndex(e.batIndex, median);
      if (t === "bat_road") m.batRoad += games;
      else if (t === "balanced") m.balanced += games;
      else m.bowlFriendly += games;
    }
    out.push(m);
  }
  return out.sort((a, b) => b.bowlFriendly - a.bowlFriendly);
}
