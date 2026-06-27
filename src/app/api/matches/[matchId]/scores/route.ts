import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { calculateFantasyPoints } from "@/lib/fantasy-points/calculator";
import type { MatchPerformance, PlayerRole } from "@/lib/fantasy-points/types";

/**
 * GET /api/matches/[matchId]/scores?matchResultId=X
 * Returns all fantasy scores for a match.
 */
export async function GET(req: NextRequest) {
  try {
    const matchResultId = req.nextUrl.searchParams.get("matchResultId");

    if (!matchResultId) {
      return NextResponse.json(
        { error: "matchResultId is required" },
        { status: 400 }
      );
    }

    const scores = sqlite
      .prepare(
        `SELECT mfs.*, p.name as player_name, p.role as player_role, p.country
         FROM match_fantasy_scores mfs
         JOIN players p ON mfs.player_id = p.id
         WHERE mfs.match_result_id = ?
         ORDER BY mfs.fantasy_points DESC`
      )
      .all(matchResultId) as Record<string, unknown>[];

    return NextResponse.json({
      scores: scores.map((s) => ({
        id: s.id,
        matchResultId: s.match_result_id,
        playerId: s.player_id,
        playerName: s.player_name,
        playerRole: s.player_role,
        country: s.country,
        batRuns: s.bat_runs,
        batBalls: s.bat_balls,
        bat4s: s.bat_4s,
        bat6s: s.bat_6s,
        batDismissed: s.bat_dismissed,
        dismissalType: s.dismissal_type,
        bowlBalls: s.bowl_balls,
        bowlRuns: s.bowl_runs,
        bowlWickets: s.bowl_wickets,
        bowlMaidens: s.bowl_maidens,
        bowlDots: s.bowl_dots,
        bowlLbwBowled: s.bowl_lbw_bowled,
        catches: s.catches,
        stumpings: s.stumpings,
        runOuts: s.run_outs,
        directRunOuts: s.direct_run_outs,
        fantasyPoints: s.fantasy_points,
        inStartingXi: s.in_starting_xi,
      })),
    });
  } catch (error) {
    console.error("Error fetching scores:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface ScoreEntry {
  playerId: number;
  batRuns?: number;
  batBalls?: number;
  bat4s?: number;
  bat6s?: number;
  batDismissed?: boolean;
  dismissalType?: string;
  bowlBalls?: number;
  bowlRuns?: number;
  bowlWickets?: number;
  bowlMaidens?: number;
  bowlDots?: number;
  bowlLbwBowled?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  directRunOuts?: number;
  inStartingXi?: boolean;
}

/**
 * POST /api/matches/[matchId]/scores
 * Submit fantasy scores for a match.
 * Body: { matchResultId, scores: ScoreEntry[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchResultId, scores } = body as {
      matchResultId: number;
      scores: ScoreEntry[];
    };

    if (!matchResultId || !Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json(
        { error: "matchResultId and a non-empty scores array are required" },
        { status: 400 }
      );
    }

    // Verify match result exists and get tournament info
    const matchResult = sqlite
      .prepare("SELECT id, tournament_id FROM match_results WHERE id = ?")
      .get(matchResultId) as { id: number; tournament_id: number } | undefined;

    if (!matchResult) {
      return NextResponse.json(
        { error: "Match result not found" },
        { status: 404 }
      );
    }

    const tournamentId = matchResult.tournament_id;

    // Prepare statements
    const getPlayerRole = sqlite.prepare(
      "SELECT role FROM players WHERE id = ?"
    );
    const insertScore = sqlite.prepare(
      `INSERT INTO match_fantasy_scores
        (match_result_id, player_id, bat_runs, bat_balls, bat_4s, bat_6s,
         bat_dismissed, dismissal_type, bowl_balls, bowl_runs, bowl_wickets,
         bowl_maidens, bowl_dots, bowl_lbw_bowled, catches, stumpings,
         run_outs, direct_run_outs, fantasy_points, in_starting_xi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateMatchStatus = sqlite.prepare(
      "UPDATE match_results SET status = 'COMPLETED' WHERE id = ?"
    );

    // Leaderboard recalculation queries
    const getTeams = sqlite.prepare(
      "SELECT id FROM tournament_teams WHERE tournament_id = ?"
    );

    // For each team, compute total fantasy points across all completed matches,
    // applying C/VC multipliers from team_captains.
    // Team roster = sold players (auction_pool) + retained players (retained_players).
    const getTeamPoints = sqlite.prepare(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN tc.role = 'C' THEN mfs.fantasy_points * 2
             WHEN tc.role = 'VC' THEN mfs.fantasy_points * 1.5
             ELSE mfs.fantasy_points
           END
         ), 0) as total_points,
         COUNT(DISTINCT mr.id) as matches_played
       FROM (
         SELECT player_id FROM auction_pool WHERE tournament_id = ? AND sold_to_team = ?
         UNION
         SELECT player_id FROM retained_players WHERE tournament_id = ? AND team_id = ?
       ) roster
       JOIN match_fantasy_scores mfs ON mfs.player_id = roster.player_id
       JOIN match_results mr ON mfs.match_result_id = mr.id AND mr.tournament_id = ?
       LEFT JOIN team_captains tc ON tc.tournament_id = ? AND tc.team_id = ?
         AND tc.player_id = roster.player_id AND tc.match_id IS NULL
       WHERE mr.status = 'COMPLETED'`
    );

    const deleteLeaderboardEntry = sqlite.prepare(
      "DELETE FROM leaderboard WHERE tournament_id = ? AND team_id = ?"
    );
    const insertLeaderboardEntry = sqlite.prepare(
      `INSERT INTO leaderboard (tournament_id, team_id, total_points, matches_played)
       VALUES (?, ?, ?, ?)`
    );

    // Run everything in a transaction
    const transaction = sqlite.transaction(() => {
      // Insert all scores
      for (const entry of scores) {
        const player = getPlayerRole.get(entry.playerId) as
          | { role: PlayerRole }
          | undefined;

        if (!player) {
          throw new Error(`Player not found: ${entry.playerId}`);
        }

        const inXi = entry.inStartingXi !== false; // default true

        const perf: MatchPerformance = {
          batRuns: entry.batRuns ?? 0,
          batBalls: entry.batBalls ?? 0,
          bat4s: entry.bat4s ?? 0,
          bat6s: entry.bat6s ?? 0,
          batDismissed: entry.batDismissed ?? false,
          dismissalType: entry.dismissalType,
          bowlBalls: entry.bowlBalls ?? 0,
          bowlRuns: entry.bowlRuns ?? 0,
          bowlWickets: entry.bowlWickets ?? 0,
          bowlMaidens: entry.bowlMaidens ?? 0,
          bowlDots: entry.bowlDots ?? 0,
          bowlLbwBowled: entry.bowlLbwBowled ?? 0,
          catches: entry.catches ?? 0,
          stumpings: entry.stumpings ?? 0,
          runOuts: entry.runOuts ?? 0,
          directRunOuts: entry.directRunOuts ?? 0,
        };

        const breakdown = calculateFantasyPoints(perf, player.role);
        const fantasyPoints = inXi ? breakdown.total : 0;

        insertScore.run(
          matchResultId,
          entry.playerId,
          perf.batRuns,
          perf.batBalls,
          perf.bat4s,
          perf.bat6s,
          perf.batDismissed ? 1 : 0,
          perf.dismissalType ?? null,
          perf.bowlBalls,
          perf.bowlRuns,
          perf.bowlWickets,
          perf.bowlMaidens,
          perf.bowlDots,
          perf.bowlLbwBowled,
          perf.catches,
          perf.stumpings,
          perf.runOuts,
          perf.directRunOuts,
          fantasyPoints,
          inXi ? 1 : 0
        );
      }

      // Mark match as completed
      updateMatchStatus.run(matchResultId);

      // Recalculate leaderboard for all teams in the tournament
      const teams = getTeams.all(tournamentId) as { id: number }[];
      for (const team of teams) {
        const result = getTeamPoints.get(
          tournamentId,
          team.id,
          tournamentId,
          team.id,
          tournamentId,
          tournamentId,
          team.id
        ) as { total_points: number; matches_played: number };

        deleteLeaderboardEntry.run(tournamentId, team.id);
        insertLeaderboardEntry.run(
          tournamentId,
          team.id,
          result.total_points,
          result.matches_played
        );
      }
    });

    transaction();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting scores:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
