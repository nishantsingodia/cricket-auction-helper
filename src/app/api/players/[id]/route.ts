import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { calculateFantasyPoints } from "@/lib/fantasy-points/calculator";
import type { MatchPerformance, PlayerRole } from "@/lib/fantasy-points/types";
import { getTourVenueContext } from "@/lib/venues/tour-venues";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id);

  if (isNaN(playerId)) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  // Player basic info
  const player = await sqlite
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(playerId) as Record<string, unknown> | undefined;

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Career stats (all formats)
  const careerStats = await sqlite
    .prepare("SELECT * FROM career_stats WHERE player_id = ? ORDER BY format")
    .all(playerId) as Record<string, unknown>[];

  // Recent match performances (last 20)
  const recentMatches = await sqlite
    .prepare(`
      SELECT * FROM match_performances
      WHERE player_id = ?
      ORDER BY match_date DESC
      LIMIT 40
    `)
    .all(playerId) as Record<string, unknown>[];

  // Venue stats. When a tour is supplied AND we have a venue model for it (The Hundred / LPL
  // today), restrict to just the grounds used in that tour. The pre-aggregated player_venue_stats
  // table is keyed per cricsheet name-variant (one physical ground -> several rows, e.g.
  // "Headingley" + "Headingley, Leeds"), so we can't just filter it — we'd list each ground twice.
  // Instead re-aggregate straight from match_performances, merging each venue's name variants into
  // one canonical row (same variants + formulas /api/venues and the ETL use, so numbers agree).
  // Otherwise fall back to the player's career top-10 venues (used by /compare and by tours with
  // no venue model).
  const tour = req.nextUrl.searchParams.get("tour") ?? "";
  const tourVenues = tour ? await getTourVenueContext(tour) : null;

  const venueStats: Record<string, unknown>[] = tourVenues
    ? (
        // One aggregation query per ground — issued concurrently, since each
        // venue's variants are independent.
        await Promise.all(
          tourVenues.venues.map(async (v): Promise<Record<string, unknown>> => {
          const vp = v.variants.map(() => "?").join(",");
          // Per-ground aggregation mirrors compute_venue_stats() in data/etl_cricsheet.py.
          const agg = await sqlite
            .prepare(`
              SELECT
                COUNT(*) AS matches,
                SUM(COALESCE(bat_runs, 0)) AS bat_runs,
                CASE WHEN SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END) > 0
                     THEN CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END)
                     ELSE 0 END AS bat_avg,
                CASE WHEN SUM(COALESCE(bat_balls, 0)) > 0
                     THEN CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(COALESCE(bat_balls, 0)) * 100
                     ELSE 0 END AS bat_sr,
                SUM(COALESCE(bowl_wickets, 0)) AS bowl_wickets,
                CASE WHEN SUM(COALESCE(bowl_balls, 0)) > 0
                     THEN CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / (SUM(COALESCE(bowl_balls, 0)) / 6.0)
                     ELSE 0 END AS bowl_econ,
                AVG(COALESCE(fantasy_points, 0)) AS avg_fantasy_points
              FROM match_performances
              WHERE player_id = ? AND venue_name IN (${vp})
            `)
            .get(playerId, ...v.variants) as Record<string, unknown>;
          // city + pitch_type come from the venues catalog. Seed data populates these on only some
          // name variants, so MAX() (which skips NULLs in SQLite) prefers a populated value.
          const meta = ((await sqlite
            .prepare(`SELECT MAX(city) AS city, MAX(pitch_type) AS pitch_type FROM venues WHERE name IN (${vp})`)
            .get(...v.variants)) as Record<string, unknown> | undefined) ?? {};
          return { venue_name: v.canonical, ...meta, ...agg };
          })
        )
      )
        .filter((r) => (r.matches as number) > 0)
        .sort((a, b) => (b.matches as number) - (a.matches as number))
    : (await sqlite
        .prepare(`
          SELECT pvs.*, v.name as venue_name, v.city, v.country, v.pitch_type
          FROM player_venue_stats pvs
          JOIN venues v ON pvs.venue_id = v.id
          WHERE pvs.player_id = ?
          ORDER BY pvs.matches DESC
          LIMIT 10
        `)
        .all(playerId) as Record<string, unknown>[]);

  // Opposition stats (top 10 by matches)
  const oppositionStats = await sqlite
    .prepare(`
      SELECT * FROM player_opposition_stats
      WHERE player_id = ?
      ORDER BY matches DESC
      LIMIT 10
    `)
    .all(playerId) as Record<string, unknown>[];

  // Fantasy points trend (last 20 matches)
  const fantasyTrend = await sqlite
    .prepare(`
      SELECT match_date, fantasy_points, format, opposition, venue_name,
             bat_runs, bat_balls, bat_4s, bat_6s,
             bowl_wickets, bowl_balls, bowl_runs, bowl_dots,
             catches, stumpings, run_outs
      FROM match_performances
      WHERE player_id = ?
      ORDER BY match_date DESC
      LIMIT 20
    `)
    .all(playerId) as Record<string, unknown>[];

  // Compute fantasy breakdown from match performances (IPL/T20 matches)
  const breakdownMatches = await sqlite
    .prepare(`
      SELECT format, bat_runs, bat_balls, bat_4s, bat_6s, bat_dismissed, dismissal_type,
             bowl_balls, bowl_runs, bowl_wickets, bowl_maidens, bowl_dots, bowl_lbw_bowled,
             catches, stumpings, run_outs, direct_run_outs, fantasy_points
      FROM match_performances
      WHERE player_id = ? AND format IN ('IPL', 'T20I', 'T20', 'ODI')
      ORDER BY match_date DESC
      LIMIT 50
    `)
    .all(playerId) as Record<string, unknown>[];

  let fantasyBreakdown = null;
  if (breakdownMatches.length > 0) {
    const role = (player.role as PlayerRole) || "BAT";
    let sumBatting = 0, sumBowling = 0, sumFielding = 0, sumSr = 0, sumEcon = 0, sumXi = 0;
    const totals: number[] = [];

    for (const m of breakdownMatches) {
      const perf: MatchPerformance = {
        batRuns: (m.bat_runs as number) || 0,
        batBalls: (m.bat_balls as number) || 0,
        bat4s: (m.bat_4s as number) || 0,
        bat6s: (m.bat_6s as number) || 0,
        batDismissed: !!(m.bat_dismissed),
        dismissalType: (m.dismissal_type as string) || undefined,
        bowlBalls: (m.bowl_balls as number) || 0,
        bowlRuns: (m.bowl_runs as number) || 0,
        bowlWickets: (m.bowl_wickets as number) || 0,
        bowlMaidens: (m.bowl_maidens as number) || 0,
        bowlDots: (m.bowl_dots as number) || 0,
        bowlLbwBowled: (m.bowl_lbw_bowled as number) || 0,
        catches: (m.catches as number) || 0,
        stumpings: (m.stumpings as number) || 0,
        runOuts: (m.run_outs as number) || 0,
        directRunOuts: (m.direct_run_outs as number) || 0,
      };
      const bd = calculateFantasyPoints(perf, role, m.format as string);
      sumBatting += bd.batting;
      sumBowling += bd.bowling;
      sumFielding += bd.fielding;
      sumSr += bd.strikeRate;
      sumEcon += bd.economyRate;
      sumXi += bd.startingXi;
      totals.push(bd.total);
    }

    const n = breakdownMatches.length;
    const avgTotal = totals.reduce((a, b) => a + b, 0) / n;
    const variance = totals.reduce((sum, t) => sum + Math.pow(t - avgTotal, 2), 0) / n;

    fantasyBreakdown = {
      avgBatting: sumBatting / n,
      avgBowling: sumBowling / n,
      avgFielding: sumFielding / n,
      avgSrBonus: sumSr / n,
      avgEconBonus: sumEcon / n,
      avgStartingXi: sumXi / n,
      avgTotal,
      matchCount: n,
      bestMatch: Math.max(...totals),
      worstMatch: Math.min(...totals),
      consistency: Math.sqrt(variance),
    };
  }

  // Avg batting position across white-ball franchise/T20 (excludes did-not-bat: bat_position null).
  const batPosRow = await sqlite
    .prepare(
      `SELECT ROUND(AVG(bat_position), 1) AS avg_pos, COUNT(*) AS inns
       FROM match_performances
       WHERE player_id = ? AND bat_position IS NOT NULL
         AND format IN ('HUN','WPL','T20','WBBL','BLAST')`
    )
    .get(playerId) as { avg_pos: number | null; inns: number };

  return NextResponse.json({
    avgBatPosition: batPosRow.avg_pos,
    batPositionInns: batPosRow.inns,
    player: {
      id: player.id,
      name: player.name,
      fullName: player.full_name,
      country: player.country,
      role: player.role,
      batStyle: player.bat_style,
      bowlStyle: player.bowl_style,
      isOverseas: player.is_overseas,
      dob: player.dob,
    },
    fantasyBreakdown,
    careerStats: careerStats.map((cs) => ({
      format: cs.format,
      matches: cs.bat_matches,
      innings: cs.bat_innings,
      runs: cs.bat_runs,
      batAvg: cs.bat_avg,
      batSr: cs.bat_sr,
      fifties: cs.bat_50s,
      hundreds: cs.bat_100s,
      hs: cs.bat_hs,
      fours: cs.bat_4s,
      sixes: cs.bat_6s,
      bowlInnings: cs.bowl_innings,
      wickets: cs.bowl_wickets,
      bowlAvg: cs.bowl_avg,
      bowlEcon: cs.bowl_econ,
      bowlSr: cs.bowl_sr,
      catches: cs.catches,
      stumpings: cs.stumpings,
      efppm: cs.avg_fantasy_points,
      totalPoints: cs.total_fantasy_points,
    })),
    recentMatches: recentMatches.map((m) => ({
      matchId: m.match_id,
      date: m.match_date,
      format: m.format,
      batPos: m.bat_position,
      opposition: m.opposition,
      venue: m.venue_name,
      batRuns: m.bat_runs,
      batBalls: m.bat_balls,
      bat4s: m.bat_4s,
      bat6s: m.bat_6s,
      bowlWickets: m.bowl_wickets,
      bowlRuns: m.bowl_runs,
      bowlBalls: m.bowl_balls,
      catches: m.catches,
      fantasyPoints: m.fantasy_points,
    })),
    venueStats: venueStats.map((vs) => ({
      venueId: vs.venue_id,
      venueName: vs.venue_name,
      city: vs.city,
      pitchType: vs.pitch_type,
      matches: vs.matches,
      batRuns: vs.bat_runs,
      batAvg: vs.bat_avg,
      batSr: vs.bat_sr,
      bowlWickets: vs.bowl_wickets,
      bowlEcon: vs.bowl_econ,
      efppm: vs.avg_fantasy_points,
    })),
    oppositionStats: oppositionStats.map((os) => ({
      opposition: os.opposition,
      format: os.format,
      matches: os.matches,
      batRuns: os.bat_runs,
      batAvg: os.bat_avg,
      batSr: os.bat_sr,
      bowlWickets: os.bowl_wickets,
      bowlEcon: os.bowl_econ,
      efppm: os.avg_fantasy_points,
    })),
    fantasyTrend: fantasyTrend.map((ft) => ({
      date: ft.match_date,
      points: ft.fantasy_points,
      format: ft.format,
      opposition: ft.opposition,
      venue: ft.venue_name,
    })),
  });
}
