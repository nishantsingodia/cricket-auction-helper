import { T20_RULES } from "./rules";
import type { MatchPerformance, PlayerRole, FantasyPointsBreakdown } from "./types";

/**
 * Calculate Dream11 T20 fantasy points from a match performance.
 * Returns a detailed breakdown of points by category.
 */
export function calculateFantasyPoints(
  perf: MatchPerformance,
  role: PlayerRole
): FantasyPointsBreakdown {
  const r = T20_RULES;
  let batting = 0;
  let bowling = 0;
  let fielding = 0;
  let strikeRate = 0;
  let economyRate = 0;
  // +4 only if the player was actually in the XI (matches the bot's `played` gate). Defaults
  // to awarded when `played` is omitted, so existing callers are unchanged.
  const startingXi = perf.played === false ? 0 : r.other.startingXi;

  // === BATTING ===
  if (perf.batBalls > 0 || perf.batRuns > 0) {
    batting += perf.batRuns * r.batting.perRun;
    batting += perf.bat4s * r.batting.boundaryBonus;
    batting += perf.bat6s * r.batting.sixBonus;

    // Milestone bonus: HIGHEST tier only — a 50/75/century replaces the lower milestones,
    // matching the live points bot (wc_fps_to_csv.py). NOT cumulative.
    if (perf.batRuns >= 100) batting += r.batting.bonus100;
    else if (perf.batRuns >= 75) batting += r.batting.bonus75;
    else if (perf.batRuns >= 50) batting += r.batting.bonus50;
    else if (perf.batRuns >= 25) batting += r.batting.bonus25;

    // Strike rate bonus/penalty (min 10 balls, excludes bowlers)
    if (perf.batBalls >= r.strikeRate.minBalls && role !== "BOWL") {
      const sr = (perf.batRuns / perf.batBalls) * 100;
      if (sr > 170) strikeRate += r.strikeRate.above170;
      else if (sr > 150) strikeRate += r.strikeRate.above150;
      else if (sr >= 130) strikeRate += r.strikeRate.above130;
      else if (sr >= 60 && sr <= 70) strikeRate += r.strikeRate.between60_70;
      else if (sr >= 50 && sr < 60) strikeRate += r.strikeRate.between50_60;
      else if (sr < 50) strikeRate += r.strikeRate.below50;
    }
  }

  // Duck (-2) — OUTSIDE the runs/balls gate so a run-out for 0 off 0 balls still counts
  // (matches the live bot). Batters / keepers / all-rounders only.
  if (perf.batDismissed && perf.batRuns === 0 && role !== "BOWL") {
    batting += r.batting.duck;
  }

  // === BOWLING ===
  if (perf.bowlBalls > 0) {
    bowling += perf.bowlWickets * r.bowling.perWicket;
    bowling += perf.bowlLbwBowled * r.bowling.lbwBowledBonus;
    bowling += perf.bowlDots * r.bowling.dotBall;
    bowling += perf.bowlMaidens * r.bowling.maidenOver;

    if (perf.bowlWickets >= 5) bowling += r.bowling.bonus5w;
    else if (perf.bowlWickets >= 4) bowling += r.bowling.bonus4w;
    else if (perf.bowlWickets >= 3) bowling += r.bowling.bonus3w;

    // Economy rate (min 2 overs)
    if (perf.bowlBalls >= r.economyRate.minBalls) {
      const overs = perf.bowlBalls / 6;
      const econ = perf.bowlRuns / overs;
      if (econ < 5) economyRate += r.economyRate.below5;
      else if (econ < 6) economyRate += r.economyRate.between5_6;
      else if (econ <= 7) economyRate += r.economyRate.between6_7;
      else if (econ >= 10 && econ <= 11) economyRate += r.economyRate.between10_11;
      else if (econ > 11 && econ <= 12) economyRate += r.economyRate.between11_12;
      else if (econ > 12) economyRate += r.economyRate.above12;
    }
  }

  // === FIELDING ===
  fielding += perf.catches * r.fielding.catch;
  if (perf.catches >= 3) fielding += r.fielding.bonus3Catches;
  fielding += perf.stumpings * r.fielding.stumping;
  fielding += perf.directRunOuts * r.fielding.directRunOut;
  fielding += (perf.runOuts - perf.directRunOuts) * r.fielding.nonDirectRunOut;

  const total = batting + bowling + fielding + strikeRate + economyRate + startingXi;

  return { batting, bowling, fielding, strikeRate, economyRate, startingXi, total };
}

/**
 * Apply captain/vice-captain multiplier to total points.
 */
export function applyMultiplier(
  points: number,
  role: "C" | "VC" | null
): number {
  if (role === "C") return points * T20_RULES.other.captainMultiplier;
  if (role === "VC") return points * T20_RULES.other.viceCaptainMultiplier;
  return points;
}
