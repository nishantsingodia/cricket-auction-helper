import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET(request: NextRequest) {
  const auctionId = request.nextUrl.searchParams.get("auctionId");
  if (!auctionId) {
    return NextResponse.json(
      { error: "auctionId is required" },
      { status: 400 }
    );
  }

  const items = sqlite
    .prepare("SELECT * FROM watchlist WHERE auction_id = ?")
    .all(Number(auctionId));

  return NextResponse.json({ watchlist: items });
}

export async function POST(request: NextRequest) {
  try {
    const { auctionId, playerId, color, priority, notes } =
      await request.json();

    if (!auctionId || !playerId) {
      return NextResponse.json(
        { error: "auctionId and playerId are required" },
        { status: 400 }
      );
    }

    sqlite
      .prepare(
        `INSERT OR REPLACE INTO watchlist (auction_id, player_id, color, priority, notes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(auctionId, playerId, color || null, priority || 0, notes || null);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auctionId = request.nextUrl.searchParams.get("auctionId");
  const playerId = request.nextUrl.searchParams.get("playerId");

  if (!auctionId || !playerId) {
    return NextResponse.json(
      { error: "auctionId and playerId are required" },
      { status: 400 }
    );
  }

  sqlite
    .prepare("DELETE FROM watchlist WHERE auction_id = ? AND player_id = ?")
    .run(Number(auctionId), Number(playerId));

  return NextResponse.json({ success: true });
}
