import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { calculateFantasyPoints } from "@/lib/fantasy-points/calculator";
import type { MatchPerformance, PlayerRole } from "@/lib/fantasy-points/types";

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
  const player = sqlite
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(playerId) as Record<string, unknown> | undefined;

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Career stats (all formats)
  const careerStats = sqlite
    .prepare("SELECT * FROM career_stats WHERE player_id = ? ORDER BY format")
    .all(playerId) as Record<string, unknown>[];

  // Recent match performances (last 20)
  const recentMatches = sqlite
    .prepare(`
      SELECT * FROM match_performances
      WHERE player_id = ?
      ORDER BY match_date DESC
      LIMIT 40
    `)
    .all(playerId) as Record<string, unknown>[];

  // Venue stats (top 10 by matches played)
  const venueStats = sqlite
    .prepare(`
      SELECT pvs.*, v.name as venue_name, v.city, v.country, v.pitch_type
      FROM player_venue_stats pvs
      JOIN venues v ON pvs.venue_id = v.id
      WHERE pvs.player_id = ?
      ORDER BY pvs.matches DESC
      LIMIT 10
    `)
    .all(playerId) as Record<string, unknown>[];

  // Opposition stats (top 10 by matches)
  const oppositionStats = sqlite
    .prepare(`
      SELECT * FROM player_opposition_stats
      WHERE player_id = ?
      ORDER BY matches DESC
      LIMIT 10
    `)
    .all(playerId) as Record<string, unknown>[];

  // Fantasy points trend (last 20 matches)
  const fantasyTrend = sqlite
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
  const breakdownMatches = sqlite
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

  return NextResponse.json({
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
