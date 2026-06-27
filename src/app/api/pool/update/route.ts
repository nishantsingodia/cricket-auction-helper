import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

/**
 * PATCH /api/pool/update
 * Update player pool fields: role, val_expected (manual price override)
 * Body: { poolId, role?, val_expected? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      poolId: number;
      role?: string;
      val_expected?: number;
      risk_note?: string | null;
    };

    if (!body.poolId) {
      return NextResponse.json({ error: "poolId is required" }, { status: 400 });
    }

    // Update role on players table (via pool -> player_id)
    if (body.role && ["BAT", "BOWL", "AR", "WK"].includes(body.role)) {
      const poolRow = sqlite
        .prepare("SELECT player_id FROM auction_pool WHERE id = ?")
        .get(body.poolId) as { player_id: number } | undefined;

      if (poolRow) {
        sqlite
          .prepare("UPDATE players SET role = ? WHERE id = ?")
          .run(body.role, poolRow.player_id);
      }
    }

    // Update risk note (set to null to clear)
    if (body.risk_note !== undefined) {
      sqlite
        .prepare("UPDATE auction_pool SET risk_note = ? WHERE id = ?")
        .run(body.risk_note || null, body.poolId);
    }

    // Update expected price (manual override) — flag as manual so engine won't overwrite
    if (body.val_expected !== undefined) {
      const price = Math.max(1, Math.round(body.val_expected));
      sqlite
        .prepare(
          "UPDATE auction_pool SET val_expected = ?, val_floor = ?, val_ceiling = ?, price_manual = 1 WHERE id = ?"
        )
        .run(price, price, price, body.poolId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
