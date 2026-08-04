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
function read(months: number, gender: "male" | "female"): Map<string, Row> {
  const fmt = BAT_INDEX_FORMATS.map((f) => `'${f}'`).join(",");
  const rows = sqlite
    .prepare(
      `SELECT mp.venue_name AS venue,
         SUM(CASE WHEN p.role = 'BOWL' THEN 0 ELSE mp.fantasy_points END) AS bat_sum,
         SUM(CASE WHEN p.role = 'BOWL' THEN 0 ELSE 1 END) AS bat_n,
         SUM(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points ELSE 0 END) AS bowl_sum,
         SUM(CASE WHEN p.role = 'BOWL' THEN 1 ELSE 0 END) AS bowl_n,
         COUNT(DISTINCT mp.match_id) AS matches
       FROM match_performances mp
       JOIN players p ON p.id = mp.player_id
       WHERE mp.format IN (${fmt})
         AND mp.venue_name IS NOT NULL
         AND mp.fantasy_points IS NOT NULL
         AND mp.match_date >= date('now', '-${months} months')
         AND ${gender === "female" ? "p.gender = 'female'" : "(p.gender != 'female' OR p.gender IS NULL)"}
       GROUP BY mp.venue_name`
    )
    .all() as Array<{ venue: string } & Omit<Row, "ground">>;

  const out = new Map<string, Row>();
  for (const r of rows) {
    const g = canonicalVenue(r.venue);
    const cur = out.get(g) ?? { ground: g, bat_sum: 0, bat_n: 0, bowl_sum: 0, bowl_n: 0, matches: 0 };
    cur.bat_sum += r.bat_sum; cur.bat_n += r.bat_n;
    cur.bowl_sum += r.bowl_sum; cur.bowl_n += r.bowl_n; cur.matches += r.matches;
    out.set(g, cur);
  }
  return out;
}

const ratioOf = (r: Row | undefined) =>
  r && r.bat_n > 0 && r.bowl_n > 0 && r.bowl_sum > 0
    ? { idx: (r.bat_sum / r.bat_n) / (r.bowl_sum / r.bowl_n), bat: r.bat_sum / r.bat_n, bowl: r.bowl_sum / r.bowl_n }
    : null;

/** Bat Index for every ground we have a usable sample for, plus the league median for comparison. */
export function computeBatIndex(gender: "male" | "female" = "male"): {
  byGround: Map<string, BatIndexEntry>;
  median: number;
} {
  const recent = read(RECENT_MONTHS, gender);
  const wide = read(WIDE_MONTHS, gender);

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

/** Plain-language read of a ground relative to the league median. */
export function describeBatIndex(batIndex: number, median: number): {
  favours: "batting" | "bowling" | "neutral";
  pct: number; // how far from median, in %
  label: string;
} {
  const rel = batIndex / median - 1;
  const pct = Math.round(Math.abs(rel) * 100);
  if (pct < 3) return { favours: "neutral", pct, label: "Balanced" };
  return rel > 0
    ? { favours: "batting", pct, label: `Favours batting +${pct}%` }
    : { favours: "bowling", pct, label: `Favours bowling +${pct}%` };
}
