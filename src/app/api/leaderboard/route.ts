import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/leaderboard?tournamentId=X
 * Returns the leaderboard with team details, sorted by total_points DESC.
 */
export async function GET(req: NextRequest) {
  try {
    const tournamentId = req.nextUrl.searchParams.get("tournamentId");

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required" },
        { status: 400 }
      );
    }

    const rows = sqlite
      .prepare(
        `SELECT
           lb.id,
           lb.tournament_id,
           lb.team_id,
           lb.total_points,
           lb.matches_played,
           tt.name as team_name,
           tt.short_name,
           tt.color
         FROM leaderboard lb
         JOIN tournament_teams tt ON lb.team_id = tt.id
         WHERE lb.tournament_id = ?
         ORDER BY lb.total_points DESC`
      )
      .all(tournamentId) as Record<string, unknown>[];

    // Get captains for badge display
    const captains = sqlite
      .prepare(
        `SELECT tc.team_id, tc.player_id, tc.role
         FROM team_captains tc
         WHERE tc.tournament_id = ? AND tc.match_id IS NULL`
      )
      .all(tournamentId) as { team_id: number; player_id: number; role: string }[];

    // For each team, get top 5 scorers across all completed matches
    const topScorerStmt = sqlite.prepare(
      `SELECT p.id as player_id, p.name as player_name, p.role as player_role,
              SUM(mfs.fantasy_points) as total_points,
              COUNT(DISTINCT mfs.match_result_id) as matches_played
       FROM match_fantasy_scores mfs
       JOIN players p ON mfs.player_id = p.id
       JOIN auction_pool ap ON ap.player_id = p.id AND ap.tournament_id = ?
       WHERE ap.sold_to_team = ? AND mfs.in_starting_xi = 1
         AND mfs.match_result_id IN (
           SELECT id FROM match_results WHERE tournament_id = ? AND status = 'COMPLETED'
         )
       GROUP BY p.id
       ORDER BY total_points DESC
       LIMIT 5`
    );

    return NextResponse.json({
      leaderboard: rows.map((r) => {
        const teamId = r.team_id as number;

        const scorers = topScorerStmt.all(tournamentId, teamId, tournamentId) as Record<string, unknown>[];

        return {
          id: r.id,
          tournamentId: r.tournament_id,
          teamId,
          totalPoints: r.total_points,
          matchesPlayed: r.matches_played,
          teamName: r.team_name,
          shortName: r.short_name,
          color: r.color,
          topScorers: scorers.map((s) => {
            const cap = captains.find(
              (c) => c.team_id === teamId && c.player_id === (s.player_id as number)
            );
            return {
              playerId: s.player_id,
              playerName: s.player_name,
              playerRole: s.player_role,
              totalPoints: s.total_points,
              matchesPlayed: s.matches_played,
              captainRole: cap ? cap.role : null,
            };
          }),
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
