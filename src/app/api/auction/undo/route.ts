import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * POST /api/auction/undo
 * Undo a sale — revert player to AVAILABLE and restore purse.
 * Body: { auctionId, playerId } or legacy { poolId, tournamentId }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // New participant-based flow
  if (body.auctionId && body.playerId) {
    return undoParticipant(body);
  }

  // Legacy flow
  if (body.poolId && body.tournamentId) {
    return undoLegacy(body);
  }

  return NextResponse.json(
    { error: "Required: auctionId + playerId, or poolId + tournamentId" },
    { status: 400 }
  );
}

function undoParticipant(body: { auctionId: number; playerId: number }) {
  const { auctionId, playerId } = body;

  const poolEntry = sqlite
    .prepare(
      "SELECT * FROM auction_pool WHERE auction_id = ? AND player_id = ?"
    )
    .get(auctionId, playerId) as Record<string, unknown> | undefined;

  if (!poolEntry) {
    return NextResponse.json({ error: "Player not in pool" }, { status: 404 });
  }

  if (poolEntry.status !== "SOLD") {
    return NextResponse.json(
      { error: "Player is not sold" },
      { status: 400 }
    );
  }

  // Restore participant purse
  if (poolEntry.sold_to_participant && poolEntry.sold_price) {
    sqlite
      .prepare(
        `UPDATE auction_participants SET remaining_purse = remaining_purse + ? WHERE id = ?`
      )
      .run(poolEntry.sold_price, poolEntry.sold_to_participant);
  }

  // Revert to available
  sqlite
    .prepare(
      `UPDATE auction_pool
       SET status = 'AVAILABLE', sold_to_participant = NULL, sold_price = NULL, sold_at = NULL
       WHERE auction_id = ? AND player_id = ?`
    )
    .run(auctionId, playerId);

  return NextResponse.json({ success: true });
}

function undoLegacy(body: { poolId: number; tournamentId: number }) {
  const { poolId, tournamentId } = body;

  const poolEntry = sqlite
    .prepare("SELECT * FROM auction_pool WHERE id = ? AND tournament_id = ?")
    .get(poolId, tournamentId) as Record<string, unknown> | undefined;

  if (!poolEntry) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (poolEntry.status !== "SOLD" && poolEntry.status !== "UNSOLD") {
    return NextResponse.json(
      { error: "Player is already available" },
      { status: 400 }
    );
  }

  if (
    poolEntry.status === "SOLD" &&
    poolEntry.sold_to_team &&
    poolEntry.sold_price
  ) {
    sqlite
      .prepare(
        `UPDATE tournament_teams SET remaining_purse = remaining_purse + ? WHERE id = ?`
      )
      .run(poolEntry.sold_price, poolEntry.sold_to_team);
  }

  sqlite
    .prepare(
      `UPDATE auction_pool
       SET status = 'AVAILABLE', sold_to_team = NULL, sold_price = NULL, sold_at = NULL
       WHERE id = ?`
    )
    .run(poolId);

  return NextResponse.json({ success: true });
}
