import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET() {
  const tournaments = sqlite
    .prepare("SELECT * FROM tournaments ORDER BY created_at DESC")
    .all();
  return NextResponse.json({ tournaments });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    format,
    matchFormat,
    pursePerTeam,
    currencyUnit,
    maxSquadSize,
    maxOverseas,
    maxOverseasSquad,
    numCaptains,
    numViceCaptains,
    teams,
    playerIds,
  } = body;

  // Validate
  if (!name || !teams || teams.length === 0) {
    return NextResponse.json({ error: "Name and teams are required" }, { status: 400 });
  }

  const tournamentResult = sqlite
    .prepare(`
      INSERT INTO tournaments (name, format, match_format, purse_per_team, currency_unit,
        max_squad_size, max_overseas, max_overseas_squad, num_captains, num_vice_captains, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SETUP')
    `)
    .run(
      name,
      format || "IPL",
      matchFormat || "T20",
      pursePerTeam || 100,
      currencyUnit || "Cr",
      maxSquadSize || 25,
      maxOverseas || 4,
      maxOverseasSquad || 8,
      numCaptains || 1,
      numViceCaptains || 1
    );

  const tournamentId = tournamentResult.lastInsertRowid;

  // Insert teams
  const insertTeam = sqlite.prepare(`
    INSERT INTO tournament_teams (tournament_id, name, short_name, color, remaining_purse)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const team of teams) {
    insertTeam.run(
      tournamentId,
      team.name,
      team.shortName || team.name.substring(0, 3).toUpperCase(),
      team.color || "#6366f1",
      pursePerTeam || 100
    );
  }

  // Add players to auction pool if provided
  if (playerIds && playerIds.length > 0) {
    const insertPool = sqlite.prepare(`
      INSERT OR IGNORE INTO auction_pool (tournament_id, player_id, base_price, status)
      VALUES (?, ?, ?, 'AVAILABLE')
    `);

    for (const pid of playerIds) {
      insertPool.run(tournamentId, pid.id || pid, pid.basePrice || 0.5);
    }
  }

  return NextResponse.json({
    tournament: { id: Number(tournamentId), name, status: "SETUP" },
  });
}
