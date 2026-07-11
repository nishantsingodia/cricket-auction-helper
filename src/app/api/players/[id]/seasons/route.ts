import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/players/[id]/seasons
 * Returns the player's stats broken down by TOUR × YEAR — every tour is its own
 * row: leagues (IPL/MLC/WPL) by year, and internationals by cricsheet series name
 * ("India tour of England", "ICC Men's T20 World Cup", …). Also returns `leagueSeasons`
 * (league rows only) for the Fantasy tab's "Last IPL" summary.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id);

  if (isNaN(playerId)) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  // --- Tour × Year: one row per tour per year, across ALL formats ---
  // Tour label: leagues use their format code (IPL/MLC/WPL); internationals use the
  // cricsheet series name; event-less matches fall into an "Other T20Is" bucket.
  const tours = sqlite
    .prepare(
      `SELECT
        CASE
          WHEN format IN ('IPL','MLC','WPL') THEN format
          WHEN format = 'ODI' THEN 'ODI'
          WHEN series IS NULL OR TRIM(series) = '' THEN 'Other T20Is'
          ELSE series
        END AS tour,
        format,
        strftime('%Y', match_date) AS year,
        COUNT(*) as matches,
        SUM(bat_runs) as runs,
        ROUND(CAST(SUM(bat_runs) AS REAL) / NULLIF(SUM(bat_dismissed), 0), 2) as bat_avg,
        ROUND(
          CASE WHEN SUM(bat_balls) > 0
            THEN CAST(SUM(bat_runs) AS REAL) / SUM(bat_balls) * 100
          END, 1
        ) as bat_sr,
        SUM(CASE WHEN bat_runs >= 50 AND bat_runs < 100 THEN 1 ELSE 0 END) as fifties,
        SUM(CASE WHEN bat_runs >= 100 THEN 1 ELSE 0 END) as hundreds,
        SUM(bat_6s) as sixes,
        SUM(bat_4s) as fours,
        SUM(bowl_wickets) as wickets,
        ROUND(
          CASE WHEN SUM(bowl_balls) > 0
            THEN CAST(SUM(bowl_runs) AS REAL) / (CAST(SUM(bowl_balls) AS REAL) / 6)
          END, 2
        ) as bowl_econ,
        ROUND(AVG(fantasy_points), 1) as avg_fantasy_points,
        SUM(fantasy_points) as total_fantasy_points,
        MAX(fantasy_points) as best_match,
        MIN(fantasy_points) as worst_match
      FROM match_performances
      WHERE player_id = ?
      GROUP BY tour, year
      ORDER BY year DESC, matches DESC`
    )
    .all(playerId) as Record<string, unknown>[];

  // --- League rows (IPL/MLC/WPL) by year — kept for the Fantasy tab's "Last IPL" card ---
  const leagueSeasons = sqlite
    .prepare(
      `SELECT
        format,
        strftime('%Y', match_date) as season,
        COUNT(*) as matches,
        SUM(bat_runs) as runs,
        ROUND(CAST(SUM(bat_runs) AS REAL) / NULLIF(SUM(bat_dismissed), 0), 2) as bat_avg,
        ROUND(
          CASE WHEN SUM(bat_balls) > 0
            THEN CAST(SUM(bat_runs) AS REAL) / SUM(bat_balls) * 100
          END, 1
        ) as bat_sr,
        SUM(bowl_wickets) as wickets,
        ROUND(AVG(fantasy_points), 1) as avg_fantasy_points
      FROM match_performances
      WHERE player_id = ? AND format IN ('IPL', 'MLC', 'WPL')
      GROUP BY format, season
      ORDER BY season DESC, CASE format WHEN 'IPL' THEN 1 WHEN 'MLC' THEN 2 ELSE 3 END`
    )
    .all(playerId) as Record<string, unknown>[];

  return NextResponse.json({
    tours: tours.map((s) => ({
      year: s.year,
      tour: s.tour,
      format: s.format,
      matches: s.matches,
      runs: s.runs,
      batAvg: s.bat_avg,
      batSr: s.bat_sr,
      fifties: s.fifties,
      hundreds: s.hundreds,
      sixes: s.sixes,
      fours: s.fours,
      wickets: s.wickets,
      bowlEcon: s.bowl_econ,
      avgFantasyPoints: s.avg_fantasy_points,
      totalFantasyPoints: s.total_fantasy_points,
      bestMatch: s.best_match,
      worstMatch: s.worst_match,
    })),
    leagueSeasons: leagueSeasons.map((s) => ({
      season: `${s.format} ${s.season}`,
      league: s.format,
      matches: s.matches,
      runs: s.runs,
      batAvg: s.bat_avg,
      batSr: s.bat_sr,
      wickets: s.wickets,
      avgFantasyPoints: s.avg_fantasy_points,
    })),
  });
}
