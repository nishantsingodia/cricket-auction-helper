import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { recalculateValuations } from "@/lib/valuation/engine";

/**
 * POST /api/pool/reorder
 * Update squad_number ordering for players within a team.
 * Body: { auctionId, iplTeam, playerOrder: [playerId, playerId, ...] }
 * playerOrder[0] gets squad_number=1, [1] gets 2, etc.
 * After reordering, recalculates valuations since squad position affects expected matches & pricing.
 */
export async function POST(request: NextRequest) {
  try {
    const { auctionId, iplTeam, playerOrder } = (await request.json()) as {
      auctionId: number;
      iplTeam: string;
      playerOrder: number[];
    };

    if (!auctionId || !iplTeam || !playerOrder?.length) {
      return NextResponse.json(
        { error: "auctionId, iplTeam, and playerOrder are required" },
        { status: 400 }
      );
    }

    // Get tournament_id for this auction
    const auction = sqlite
      .prepare("SELECT tournament_id FROM auctions WHERE id = ?")
      .get(auctionId) as { tournament_id: number } | undefined;

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    const update = sqlite.prepare(
      `UPDATE auction_pool SET squad_number = ? WHERE auction_id = ? AND player_id = ? AND ipl_team = ?`
    );

    const transaction = sqlite.transaction(() => {
      for (let i = 0; i < playerOrder.length; i++) {
        update.run(i + 1, auctionId, playerOrder[i], iplTeam);
      }
    });

    transaction();

    // Recalculate valuations since squad position affects expected matches & pricing
    recalculateValuations(auction.tournament_id, auctionId);

    return NextResponse.json({ success: true, updated: playerOrder.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
