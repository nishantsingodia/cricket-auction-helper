import { NextRequest, NextResponse } from "next/server";
import { initializeValuations } from "@/lib/valuation/engine";

/**
 * POST /api/auction/start
 * Initialize valuations and start the auction.
 */
export async function POST(req: NextRequest) {
  const { tournamentId } = await req.json();

  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
  }

  initializeValuations(tournamentId);

  return NextResponse.json({ success: true });
}
