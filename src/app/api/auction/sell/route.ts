import { NextRequest, NextResponse } from "next/server";
import { sqlite, withTransaction } from "@/db";

/**
 * POST /api/auction/sell
 * Mark a player as sold to a participant (friend).
 * Body: { auctionId, playerId, participantId, price }
 * Legacy: { poolId, teamId, price, tournamentId }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // New participant-based flow
  if (body.auctionId && body.playerId && body.participantId !== undefined) {
    return sellToParticipant(body);
  }

  // Legacy team-based flow
  if (body.poolId && body.teamId && body.tournamentId) {
    return sellToTeamLegacy(body);
  }

  return NextResponse.json(
    { error: "Required: auctionId, playerId, participantId, price" },
    { status: 400 }
  );
}

async function sellToParticipant(body: {
  auctionId: number;
  playerId: number;
  participantId: number;
  price: number;
}) {
  const { auctionId, playerId, participantId, price } = body;

  // Get pool entry
  const poolEntry = await sqlite
    .prepare(
      "SELECT * FROM auction_pool WHERE auction_id = ? AND player_id = ?"
    )
    .get(auctionId, playerId) as Record<string, unknown> | undefined;

  if (!poolEntry) {
    return NextResponse.json({ error: "Player not in pool" }, { status: 404 });
  }

  if (poolEntry.status === "SOLD") {
    return NextResponse.json(
      { error: "Player already sold" },
      { status: 400 }
    );
  }

  // Get participant
  const participant = await sqlite
    .prepare(
      "SELECT * FROM auction_participants WHERE id = ? AND auction_id = ?"
    )
    .get(participantId, auctionId) as Record<string, unknown> | undefined;

  if (!participant) {
    return NextResponse.json(
      { error: "Participant not found" },
      { status: 404 }
    );
  }

  const remainingPurse = participant.remaining_purse as number;
  if (price > remainingPurse) {
    return NextResponse.json(
      {
        error: `Insufficient purse. ${participant.name} has ${remainingPurse} remaining.`,
      },
      { status: 400 }
    );
  }

  // Check players per friend limit
  const auction = await sqlite
    .prepare("SELECT * FROM auctions WHERE id = ?")
    .get(auctionId) as Record<string, unknown>;

  const currentCount = await sqlite
    .prepare(
      `SELECT COUNT(*) as cnt FROM auction_pool
       WHERE auction_id = ? AND sold_to_participant = ? AND status = 'SOLD'`
    )
    .get(auctionId, participantId) as { cnt: number };

  if (currentCount.cnt >= (auction.players_per_friend as number)) {
    return NextResponse.json(
      { error: `${participant.name} has reached the player limit` },
      { status: 400 }
    );
  }

  // Execute sale.
  // The sold row and the purse debit MUST land together. They were two independent statements when
  // the DB was a local file and the gap was microseconds; against Turso they are two network
  // round-trips, so a drop in between would leave money debited with no matching sale — the silent
  // over-charge CLAUDE.md warns about (`remaining_purse = purse − SUM(sold_price)` no longer holds).
  const now = new Date().toISOString();

  await withTransaction(async (tx) => {
    await tx
      .prepare(
        `UPDATE auction_pool
         SET status = 'SOLD', sold_to_participant = ?, sold_price = ?, sold_at = ?
         WHERE auction_id = ? AND player_id = ?`
      )
      .run(participantId, price, now, auctionId, playerId);

    // Update participant purse
    await tx
      .prepare(
        `UPDATE auction_participants SET remaining_purse = remaining_purse - ? WHERE id = ?`
      )
      .run(price, participantId);
  });

  return NextResponse.json({ success: true });
}

async function sellToTeamLegacy(body: {
  poolId: number;
  teamId: number;
  price: number;
  tournamentId: number;
}) {
  const { poolId, teamId, price, tournamentId } = body;

  const poolEntry = await sqlite
    .prepare("SELECT * FROM auction_pool WHERE id = ? AND tournament_id = ?")
    .get(poolId, tournamentId) as Record<string, unknown> | undefined;

  if (!poolEntry) {
    return NextResponse.json({ error: "Player not in pool" }, { status: 404 });
  }
  if (poolEntry.status === "SOLD") {
    return NextResponse.json(
      { error: "Player already sold" },
      { status: 400 }
    );
  }

  const team = await sqlite
    .prepare(
      "SELECT * FROM tournament_teams WHERE id = ? AND tournament_id = ?"
    )
    .get(teamId, tournamentId) as Record<string, unknown> | undefined;

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const remainingPurse = team.remaining_purse as number;
  if (price > remainingPurse) {
    return NextResponse.json(
      { error: `Insufficient purse. Team has ${remainingPurse} remaining.` },
      { status: 400 }
    );
  }

  // Sold row + purse debit are atomic — see the note in sellToParticipant above.
  const now = new Date().toISOString();
  await withTransaction(async (tx) => {
    await tx
      .prepare(
        `UPDATE auction_pool SET status = 'SOLD', sold_to_team = ?, sold_price = ?, sold_at = ? WHERE id = ?`
      )
      .run(teamId, price, now, poolId);

    await tx
      .prepare(
        `UPDATE tournament_teams SET remaining_purse = remaining_purse - ? WHERE id = ?`
      )
      .run(price, teamId);
  });

  return NextResponse.json({ success: true });
}
