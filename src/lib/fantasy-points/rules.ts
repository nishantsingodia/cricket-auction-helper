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
