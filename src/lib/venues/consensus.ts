// Tour-level bat-vs-bowl "general stats" — the always-visible auction-header signal that says, for
// THIS tour's format, whether history rewards batting or bowling and by how much. Works for EVERY
// tour (not just the venue-model ones) because it's scoped by format + gender, not by ground. Same
// batter-FP ÷ bowler-FP read the EFPPM venue factor uses, pooled across the tour's format history.

import { sqlite } from "@/db";
import { WOMENS_T20_WC_2026_NAME } from "@/lib/squads/womens-t20-wc-2026";
import { IND_VS_ENG_T20_2026_NAME } from "@/lib/squads/ind-vs-eng-t20-2026";
import { IRE_VS_WI_W_ODI_2026_NAME } from "@/lib/squads/ire-wi-w-odi-2026";
import { NZ_VS_WI_MEN_ODI_2026_NAME } from "@/lib/squads/nz-wi-men-odi-2026";
import {
  THE_HUNDRED_MEN_2026_NAME,
  THE_HUNDRED_WOMEN_2026_NAME,
} from "@/lib/squads/the-hundred-2026";
import { LPL_2026_NAME } from "@/lib/squads/lpl-2026";
import { MLC_2026_NAME } from "@/lib/squads/mlc-2026";

export interface TourStatScope {
  formats: string[];
  gender: "male" | "female";
}

// tournament_name -> the format(s) + gender to read the tour's own conditions from. Each league
// uses its own format code (enough history for a bat/bowl ratio); bilaterals/WCs use T20/ODI.
export function getTourStatScope(name: string): TourStatScope | null {
  switch (name) {
    case THE_HUNDRED_MEN_2026_NAME: return { formats: ["HUN"], gender: "male" };
    case THE_HUNDRED_WOMEN_2026_NAME: return { formats: ["HUN"], gender: "female" };
    case LPL_2026_NAME: return { formats: ["LPL"], gender: "male" };
    case MLC_2026_NAME: return { formats: ["MLC"], gender: "male" };
    case WOMENS_T20_WC_2026_NAME: return { formats: ["T20"], gender: "female" };
    case IND_VS_ENG_T20_2026_NAME: return { formats: ["T20"], gender: "male" };
    case IRE_VS_WI_W_ODI_2026_NAME: return { formats: ["ODI"], gender: "female" };
    case NZ_VS_WI_MEN_ODI_2026_NAME: return { formats: ["ODI"], gender: "male" };
    default:
      // IPL (default tour) + any IPL-named auction
      return name.toLowerCase().includes("ipl") ? { formats: ["IPL"], gender: "male" } : null;
  }
}

export interface TourConsensus {
  lean: "batting" | "bowling" | "balanced";
  marginPct: number; // how much the favoured discipline out-scores the other, %
  batFp: number | null; // avg batter/keeper fantasy points
  bowlFp: number | null; // avg bowler fantasy points
  matches: number;
  formats: string[];
  gender: "male" | "female";
}

export function computeTourConsensus(scope: TourStatScope): TourConsensus {
  const fmt = scope.formats.map(() => "?").join(",");
  const row = sqlite
    .prepare(
      `SELECT
         AVG(CASE WHEN p.role IN ('BAT','WK') THEN mp.fantasy_points END) AS bat_fp,
         AVG(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points END) AS bowl_fp,
         COUNT(DISTINCT mp.match_id) AS matches
       FROM match_performances mp
       JOIN players p ON mp.player_id = p.id
       WHERE mp.format IN (${fmt}) AND p.gender = ? AND mp.match_date >= '2020-01-01'`
    )
    .get(...scope.formats, scope.gender) as {
    bat_fp: number | null;
    bowl_fp: number | null;
    matches: number;
  };
  const b = row.bat_fp, w = row.bowl_fp;
  let lean: TourConsensus["lean"] = "balanced";
  let marginPct = 0;
  if (b && w) {
    marginPct = Math.round((Math.max(b, w) / Math.min(b, w) - 1) * 100);
    lean = marginPct < 3 ? "balanced" : w > b ? "bowling" : "batting";
  }
  return {
    lean,
    marginPct,
    batFp: b != null ? Math.round(b * 10) / 10 : null,
    bowlFp: w != null ? Math.round(w * 10) / 10 : null,
    matches: row.matches,
    formats: scope.formats,
    gender: scope.gender,
  };
}
