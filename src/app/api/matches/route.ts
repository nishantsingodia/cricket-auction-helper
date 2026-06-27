import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/matches?tournamentId=X
 * Returns all match results for a tournament, ordered by date.
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

    const matches = sqlite
      .prepare(
        `SELECT mr.*, v.name as venue_name, v.city as venue_city
         FROM match_results mr
         LEFT JOIN venues v ON mr.venue_id = v.id
         WHERE mr.tournament_id = ?
         ORDER BY mr.match_date ASC`
      )
      .all(tournamentId) as Record<string, unknown>[];

    return NextResponse.json({
      matches: matches.map((m) => ({
        id: m.id,
        tournamentId: m.tournament_id,
        matchId: m.match_id,
        matchDate: m.match_date,
        venueId: m.venue_id,
        venueName: m.venue_name,
        venueCity: m.venue_city,
        team1: m.team1,
        team2: m.team2,
        result: m.result,
        status: m.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matches
 * Create a new match.
 * Body: { tournamentId, matchDate, team1, team2, venueId? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, matchDate, team1, team2, venueId } = body;

    if (!tournamentId || !matchDate || !team1 || !team2) {
      return NextResponse.json(
        { error: "tournamentId, matchDate, team1, and team2 are required" },
        { status: 400 }
      );
    }

    // Count existing matches to auto-generate matchId
    const countResult = sqlite
      .prepare(
        "SELECT COUNT(*) as count FROM match_results WHERE tournament_id = ?"
      )
      .get(tournamentId) as { count: number };

    const matchId = `T${tournamentId}_M${countResult.count + 1}`;

    const result = sqlite
      .prepare(
        `INSERT INTO match_results (tournament_id, match_id, match_date, venue_id, team1, team2, status)
         VALUES (?, ?, ?, ?, ?, ?, 'UPCOMING')`
      )
      .run(tournamentId, matchId, matchDate, venueId ?? null, team1, team2);

    return NextResponse.json({
      success: true,
      matchId,
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error("Error creating match:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
