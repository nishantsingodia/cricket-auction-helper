export interface MatchPerformance {
  batRuns: number;
  batBalls: number;
  bat4s: number;
  bat6s: number;
  batDismissed: boolean;
  dismissalType?: string;
  bowlBalls: number;
  bowlRuns: number;
  bowlWickets: number;
  bowlMaidens: number;
  bowlDots: number;
  bowlLbwBowled: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  directRunOuts: number;
  played?: boolean; // false ⇒ no +4 XI bonus (defaults to awarded when omitted)
}

export type PlayerRole = "BAT" | "BOWL" | "AR" | "WK";

export interface FantasyPointsBreakdown {
  batting: number;
  bowling: number;
  fielding: number;
  strikeRate: number;
  economyRate: number;
  startingXi: number;
  total: number;
}
