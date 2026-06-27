import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * GET /api/captains?tournamentId=X&teamId=Y
 * Returns current C/VC assignments for a team (tournament-wide, i.e. match_id IS NULL).
 */
export async function GET(req: NextRequest) {
  try {
    const tournamentId = req.nextUrl.searchParams.get("tournamentId");
    const teamId = req.nextUrl.searchParams.get("teamId");

    if (!tournamentId || !teamId) {
      return NextResponse.json(
        { error: "tournamentId and teamId are required" },
        { status: 400 }
      );
    }

    const captains = sqlite
      .prepare(
        `SELECT tc.id, tc.player_id, tc.role, p.name as player_name, p.role as player_role
         FROM team_captains tc
         JOIN players p ON tc.player_id = p.id
         WHERE tc.tournament_id = ? AND tc.team_id = ? AND tc.match_id IS NULL`
      )
      .all(tournamentId, teamId) as Record<string, unknown>[];

    return NextResponse.json({
      captains: captains.map((c) => ({
        id: c.id,
        playerId: c.player_id,
        role: c.role,
        playerName: c.player_name,
        playerRole: c.player_role,
      })),
    });
  } catch (error) {
    console.error("Error fetching captains:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/captains
 * Set captains for a team.
 * Body: { tournamentId, teamId, captains: [{ playerId, role: "C"|"VC" }] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, teamId, captains } = body;

    if (!tournamentId || !teamId || !Array.isArray(captains)) {
      return NextResponse.json(
        { error: "tournamentId, teamId, and captains array are required" },
        { status: 400 }
      );
    }

    // Validate roles
    for (const cap of captains) {
      if (!cap.playerId || !["C", "VC"].includes(cap.role)) {
        return NextResponse.json(
          { error: "Each captain must have a playerId and role (C or VC)" },
          { status: 400 }
        );
      }
    }

    // Get tournament limits
    const tournament = sqlite
      .prepare("SELECT num_captains, num_vice_captains FROM tournaments WHERE id = ?")
      .get(tournamentId) as Record<string, number> | undefined;

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const cCount = captains.filter((c: { role: string }) => c.role === "C").length;
    const vcCount = captains.filter((c: { role: string }) => c.role === "VC").length;

    if (cCount > tournament.num_captains) {
      return NextResponse.json(
        {
          error: `Too many captains: ${cCount} provided, max ${tournament.num_captains}`,
        },
        { status: 400 }
      );
    }

    if (vcCount > tournament.num_vice_captains) {
      return NextResponse.json(
        {
          error: `Too many vice-captains: ${vcCount} provided, max ${tournament.num_vice_captains}`,
        },
        { status: 400 }
      );
    }

    // Transaction: delete existing + insert new
    const deleteStmt = sqlite.prepare(
      "DELETE FROM team_captains WHERE tournament_id = ? AND team_id = ? AND match_id IS NULL"
    );
    const insertStmt = sqlite.prepare(
      "INSERT INTO team_captains (tournament_id, team_id, player_id, role, match_id) VALUES (?, ?, ?, ?, NULL)"
    );

    const transaction = sqlite.transaction(() => {
      deleteStmt.run(tournamentId, teamId);
      for (const cap of captains) {
        insertStmt.run(tournamentId, teamId, cap.playerId, cap.role);
      }
    });

    transaction();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting captains:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
