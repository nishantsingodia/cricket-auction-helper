import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * POST /api/auction/availability
 * Update a player's availability and news notes in the auction pool.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poolId, availability, newsNotes } = body;

    if (!poolId || !availability) {
      return NextResponse.json(
        { error: "poolId and availability are required" },
        { status: 400 }
      );
    }

    const validValues = ["FIT", "DOUBTFUL", "INJURED", "UNAVAILABLE"];
    if (!validValues.includes(availability)) {
      return NextResponse.json(
        { error: `availability must be one of: ${validValues.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = sqlite
      .prepare("SELECT id FROM auction_pool WHERE id = ?")
      .get(poolId);

    if (!existing) {
      return NextResponse.json(
        { error: "Auction pool entry not found" },
        { status: 404 }
      );
    }

    sqlite
      .prepare(
        "UPDATE auction_pool SET availability = ?, news_notes = ? WHERE id = ?"
      )
      .run(availability, newsNotes ?? null, poolId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
