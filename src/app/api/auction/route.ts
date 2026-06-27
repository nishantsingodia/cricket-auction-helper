import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/auction?tournamentId=X
 * Returns full auction state: pool, teams, sold players, valuations
 */
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
  }

  const tournament = sqlite
    .prepare("SELECT * FROM tournaments WHERE id = ?")
    .get(tournamentId) as Record<string, unknown> | undefined;

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const teams = sqlite
    .prepare("SELECT * FROM tournament_teams WHERE tournament_id = ? ORDER BY name")
    .all(tournamentId) as Record<string, unknown>[];

  // Get auction pool with player details and career stats
  const pool = sqlite
    .prepare(`
      SELECT
        ap.*,
        p.name as player_name, p.country, p.role, p.bat_style, p.bowl_style,
        p.is_overseas, p.dob,
        cs.bat_matches, cs.bat_runs, cs.bat_avg, cs.bat_sr, cs.bat_50s, cs.bat_100s,
        cs.bat_4s, cs.bat_6s,
        cs.bowl_wickets, cs.bowl_avg, cs.bowl_econ,
        cs.catches, cs.stumpings,
        cs.avg_fantasy_points as career_efppm, cs.total_fantasy_points
      FROM auction_pool ap
      JOIN players p ON ap.player_id = p.id
      LEFT JOIN career_stats cs ON cs.player_id = p.id AND cs.format = ?
      WHERE ap.tournament_id = ?
      ORDER BY
        CASE ap.status
          WHEN 'AVAILABLE' THEN 1
          WHEN 'UNSOLD' THEN 2
          WHEN 'SOLD' THEN 3
        END,
        COALESCE(ap.efppm, cs.avg_fantasy_points, 0) DESC
    `)
    .all(tournament.match_format === "T20" ? "IPL" : tournament.match_format, tournamentId) as Record<string, unknown>[];

  // Get sold players grouped by team
  const soldByTeam: Record<number, unknown[]> = {};
  for (const team of teams) {
    const teamId = team.id as number;
    soldByTeam[teamId] = pool.filter(
      (p) => p.status === "SOLD" && p.sold_to_team === teamId
    );
  }

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      format: tournament.format,
      matchFormat: tournament.match_format,
      pursePerTeam: tournament.purse_per_team,
      currencyUnit: tournament.currency_unit,
      maxSquadSize: tournament.max_squad_size,
      maxOverseas: tournament.max_overseas,
      maxOverseasSquad: tournament.max_overseas_squad,
      numCaptains: tournament.num_captains,
      numViceCaptains: tournament.num_vice_captains,
      status: tournament.status,
    },
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.short_name,
      color: t.color,
      remainingPurse: t.remaining_purse,
      squadCount: (soldByTeam[t.id as number] || []).length,
      overseasCount: (soldByTeam[t.id as number] || []).filter(
        (p) => (p as Record<string, unknown>).is_overseas
      ).length,
    })),
    pool: pool.map((p) => ({
      poolId: p.id,
      playerId: p.player_id,
      name: p.player_name,
      country: p.country,
      role: p.role,
      batStyle: p.bat_style,
      bowlStyle: p.bowl_style,
      isOverseas: p.is_overseas,
      dob: p.dob,
      basePrice: p.base_price,
      status: p.status,
      soldToTeam: p.sold_to_team,
      soldPrice: p.sold_price,
      soldAt: p.sold_at,
      availability: p.availability,
      newsNotes: p.news_notes,
      valuation: {
        floor: p.val_floor,
        expected: p.val_expected,
        ceiling: p.val_ceiling,
        efppm: p.efppm || p.career_efppm,
      },
      stats: {
        matches: p.bat_matches,
        runs: p.bat_runs,
        batAvg: p.bat_avg,
        batSr: p.bat_sr,
        fifties: p.bat_50s,
        hundreds: p.bat_100s,
        fours: p.bat_4s,
        sixes: p.bat_6s,
        wickets: p.bowl_wickets,
        bowlAvg: p.bowl_avg,
        bowlEcon: p.bowl_econ,
        catches: p.catches,
        stumpings: p.stumpings,
        totalPoints: p.total_fantasy_points,
      },
    })),
    summary: {
      totalPlayers: pool.length,
      available: pool.filter((p) => p.status === "AVAILABLE").length,
      sold: pool.filter((p) => p.status === "SOLD").length,
      unsold: pool.filter((p) => p.status === "UNSOLD").length,
    },
  });
}
