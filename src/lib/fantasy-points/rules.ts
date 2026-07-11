/**
 * Dream11 Fantasy Cricket Points System — T20 Format (Latest 2026)
 *
 * These constants define the complete scoring rules.
 * Modify this file to update the point system.
 */

export const T20_RULES = {
  batting: {
    perRun: 1,
    boundaryBonus: 4, // +4 per four (total 8 = 4 run + 4 bonus)
    sixBonus: 6, // +6 per six (total 12 = 6 run + 6 bonus)
    bonus25: 4,
    bonus50: 8,
    bonus75: 12,
    bonus100: 16, // Century replaces all lower milestones
    duck: -2, // BAT, WK, AR only — not pure bowlers
  },
  bowling: {
    perWicket: 30,
    lbwBowledBonus: 8, // per wicket via LBW or bowled
    dotBall: 1,
    maidenOver: 12,
    bonus3w: 4,
    bonus4w: 8,
    bonus5w: 12,
  },
  fielding: {
    catch: 8,
    bonus3Catches: 4,
    stumping: 12,
    directRunOut: 12,
    nonDirectRunOut: 6,
  },
  strikeRate: {
    // min 10 balls faced, excludes pure bowlers
    minBalls: 10,
    above170: 6,
    above150: 4,
    above130: 2,
    between60_70: -2,
    between50_60: -4,
    below50: -6,
  },
  economyRate: {
    // min 2 overs (12 balls) bowled
    minBalls: 12,
    below5: 6,
    between5_6: 4,
    between6_7: 2,
    between10_11: -2,
    between11_12: -4,
    above12: -6,
  },
  other: {
    startingXi: 4,
    captainMultiplier: 2,
    viceCaptainMultiplier: 1.5,
  },
} as const;

/**
 * Dream11 Fantasy Cricket Points System — ODI / One-Day Format (per Nishant's
 * config, Jul 2026). Mirrors the OD points table. Differs from T20 in:
 *   - Duck -3 (T20 is -2)
 *   - Dot ball: +1 for every 3 dot balls (T20 is +1 per dot)
 *   - Maiden over +4 (T20 is +12)
 *   - Wicket hauls start at 4w: 4w/5w/6w = +4/+8/+12 (T20 is 3w/4w/5w)
 *   - Strike-rate bands shifted down (>140 / 120.1-140 / 100-120 ; 40-50 / 30-39.99 / <30),
 *     applied at min 20 balls (Standard D11 ODI)
 *   - Economy bands shifted down (<2.5 / 2.5-3.49 / 3.5-4.5 ; 7-8 / 8.01-9 / >9),
 *     applied at min 5 overs (30 balls)
 * Batting run/boundary/six/milestones and all fielding values are identical to T20.
 */
export const ODI_RULES = {
  batting: {
    perRun: 1,
    boundaryBonus: 4,
    sixBonus: 6,
    bonus25: 4,
    bonus50: 8,
    bonus75: 12,
    bonus100: 16,
    duck: -3, // ODI: -3 (T20 is -2). BAT/WK/AR only.
  },
  bowling: {
    perWicket: 30,
    lbwBowledBonus: 8,
    dotBallGroup: 3, // +1 for every 3 dot balls (floor)
    dotBallPoints: 1,
    maidenOver: 4, // ODI: +4 (T20 is +12)
    bonus4w: 4, // hauls start at 4 wickets in ODI
    bonus5w: 8,
    bonus6w: 12,
  },
  fielding: {
    catch: 8,
    bonus3Catches: 4,
    stumping: 12,
    directRunOut: 12,
    nonDirectRunOut: 6,
  },
  strikeRate: {
    // min 20 balls faced (Standard D11 ODI), excludes pure bowlers
    minBalls: 20,
    above140: 6, // SR > 140
    above120: 4, // 120.1-140  (SR > 120, ≤ 140)
    above100: 2, // 100-120    (SR ≥ 100, ≤ 120)
    between40_50: -2, // 40-50    (SR ≥ 40, ≤ 50)
    between30_40: -4, // 30-39.99 (SR ≥ 30, < 40)
    below30: -6, // SR < 30
  },
  economyRate: {
    // min 5 overs (30 balls) bowled (Standard D11 ODI)
    minBalls: 30,
    below2_5: 6, // econ < 2.5
    between2_5_3_49: 4, // 2.5-3.49  (≥ 2.5, < 3.5)
    between3_5_4_5: 2, // 3.5-4.5   (≥ 3.5, ≤ 4.5)
    between7_8: -2, // 7-8       (≥ 7, ≤ 8)
    between8_9: -4, // 8.01-9    (> 8, ≤ 9)
    above9: -6, // econ > 9
  },
  other: {
    startingXi: 4,
    captainMultiplier: 2,
    viceCaptainMultiplier: 1.5,
  },
} as const;

/** Scoring formats the calculator understands. Everything not ODI scores as T20. */
export type ScoringFormat = "T20" | "ODI";

/** Map any stored match `format` string to a scoring ruleset. ODI → ODI; all else → T20. */
export function scoringFormatOf(format: string | null | undefined): ScoringFormat {
  return (format || "").toUpperCase() === "ODI" ? "ODI" : "T20";
}
