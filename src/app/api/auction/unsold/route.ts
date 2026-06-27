import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { recalculateValuations } from "@/lib/valuation/engine";

/**
 * POST /api/auction/unsold
 * Mark a player as unsold.
 * Body: { poolId, tournamentId }
 */
export async function POST(req: NextRequest) {
  const { poolId, tournamentId } = await req.json();

  if (!poolId || !tournamentId) {
    return NextResponse.json(
      { error: "poolId and tournamentId are required" },
      { status: 400 }
    );
  }

  sqlite.prepare(`
    UPDATE auction_pool
    SET status = 'UNSOLD', sold_to_team = NULL, sold_price = NULL, sold_at = NULL
    WHERE id = ? AND tournament_id = ?
  `).run(poolId, tournamentId);

  recalculateValuations(tournamentId);

  return NextResponse.json({ success: true });
}
