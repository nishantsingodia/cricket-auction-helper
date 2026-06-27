import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { normalizeName } from "@/lib/scrapers/ipl-squads";

interface ImportPlayer {
  name: string;
  iplTeam: string;
  country?: string;
  role?: string;
  price?: number;
  squadNumber?: number;
  isOverseas?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { auctionId, players: importPlayers } = (await request.json()) as {
      auctionId: number;
      players: ImportPlayer[];
    };

    if (!auctionId || !importPlayers?.length) {
      return NextResponse.json(
        { error: "auctionId and players array are required" },
        { status: 400 }
      );
    }

    const auction = sqlite
      .prepare("SELECT id, tournament_id FROM auctions WHERE id = ?")
      .get(auctionId) as { id: number; tournament_id: number | null } | undefined;

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    let tournamentId = auction.tournament_id;
    if (!tournamentId) {
      const result = sqlite
        .prepare(
          `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
           VALUES ('IPL 2026', 'IPL', 'T20', 120, 25)`
        )
        .run();
      tournamentId = Number(result.lastInsertRowid);
      sqlite
        .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
        .run(tournamentId, auctionId);
    }

    // Build name→id lookup
    const existingPlayers = sqlite
      .prepare("SELECT id, name FROM players")
      .all() as { id: number; name: string }[];
    const nameMap = new Map<string, number>();
    for (const p of existingPlayers) {
      nameMap.set(normalizeName(p.name), p.id);
    }

    let imported = 0;
    let matched = 0;
    let created = 0;

    const insertPlayer = sqlite.prepare(
      `INSERT INTO players (name, country, role, is_overseas) VALUES (?, ?, ?, ?)`
    );
    const insertPool = sqlite.prepare(
      `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm)
       VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?)`
    );
    const getEfppm = sqlite.prepare(
      `SELECT avg_fantasy_points FROM career_stats
       WHERE player_id = ? AND format IN ('IPL', 'T20')
       ORDER BY CASE format WHEN 'IPL' THEN 1 WHEN 'T20' THEN 2 END
       LIMIT 1`
    );

    const transaction = sqlite.transaction((data: ImportPlayer[]) => {
      for (const p of data) {
        const normalized = normalizeName(p.name);
        let playerId = nameMap.get(normalized) ?? null;

        if (playerId) {
          matched++;
        } else {
          const result = insertPlayer.run(
            p.name,
            p.country || "IND",
            p.role || "BAT",
            p.isOverseas ? 1 : 0
          );
          playerId = Number(result.lastInsertRowid);
          nameMap.set(normalized, playerId);
          created++;
        }

        const efppmRow = getEfppm.get(playerId) as {
          avg_fantasy_points: number;
        } | undefined;

        insertPool.run(
          tournamentId,
          playerId,
          p.price || 0,
          auctionId,
          p.iplTeam,
          p.squadNumber || 0,
          efppmRow?.avg_fantasy_points || 0
        );
        imported++;
      }
    });

    transaction(importPlayers);

    return NextResponse.json({ success: true, imported, matched, created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
