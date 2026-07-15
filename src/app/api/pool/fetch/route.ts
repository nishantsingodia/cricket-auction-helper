import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";
import { auctionPool, players } from "@/db/schema";
import {
  fetchAllIPLSquads,
  normalizeName,
  type ScrapedPlayer,
  type ScrapedTeam,
} from "@/lib/scrapers/ipl-squads";
import { buildWomensWCPool } from "@/lib/squads/build-womens-pool";
import { buildMLCPool } from "@/lib/squads/build-mlc-pool";
import { initializeValuations } from "@/lib/valuation/engine";
import {
  WOMENS_T20_WC_2026,
  WOMENS_T20_WC_2026_NAME,
} from "@/lib/squads/womens-t20-wc-2026";
import { MLC_2026, MLC_2026_NAME } from "@/lib/squads/mlc-2026";
import {
  IND_VS_ENG_T20_2026,
  IND_VS_ENG_T20_2026_NAME,
} from "@/lib/squads/ind-vs-eng-t20-2026";
import { buildBilateralT20Pool } from "@/lib/squads/build-bilateral-t20-pool";
import {
  IRE_VS_WI_W_ODI_2026,
  IRE_VS_WI_W_ODI_2026_NAME,
} from "@/lib/squads/ire-wi-w-odi-2026";
import { buildWomensOdiPool } from "@/lib/squads/build-womens-odi-pool";
import {
  NZ_VS_WI_MEN_ODI_2026,
  NZ_VS_WI_MEN_ODI_2026_NAME,
} from "@/lib/squads/nz-wi-men-odi-2026";
import { buildMensOdiPool } from "@/lib/squads/build-mens-odi-pool";
import {
  THE_HUNDRED_MEN_2026_NAME,
  THE_HUNDRED_WOMEN_2026_NAME,
  HUNDRED_MEN_2026,
  HUNDRED_WOMEN_2026,
} from "@/lib/squads/the-hundred-2026";
import { buildHundredPool } from "@/lib/squads/build-hundred-pool";
import { LPL_2026, LPL_2026_NAME } from "@/lib/squads/lpl-2026";
import { buildLPLPool } from "@/lib/squads/build-lpl-pool";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { auctionId, teamsFilter } = await request.json();
    if (!auctionId) {
      return NextResponse.json(
        { error: "auctionId is required" },
        { status: 400 }
      );
    }

    // Look up the auction so we can branch the pool source on its tournament.
    const auctionRow = sqlite
      .prepare("SELECT id, tournament_id, tournament_name FROM auctions WHERE id = ?")
      .get(auctionId) as
      | { id: number; tournament_id: number | null; tournament_name: string }
      | undefined;

    if (!auctionRow) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // A brand-new auction has no tournament row yet. ONLY then do we seed its
    // lineup from the most recent earlier auction of the same tour (see
    // carryOverPreviousLineups). On any later fetch (adding teams, re-fetch of a
    // live auction) tournament_id is already set, so carry-over is skipped and
    // existing lineups / sold rows are never disturbed.
    const isFirstBuild = auctionRow.tournament_id == null;

    // ---- Women's T20 World Cup 2026: build pool from announced squads in DB ----
    if (auctionRow.tournament_name === WOMENS_T20_WC_2026_NAME) {
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
             VALUES (?, 'CUSTOM', 'T20', 120, 25)`
          )
          .run(WOMENS_T20_WC_2026_NAME);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      // Optional: restrict to specific teams (by short code) so new teams can
      // be added to a live auction without re-touching existing rows.
      // Insertion is INSERT OR IGNORE, so existing pool rows are never altered.
      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? WOMENS_T20_WC_2026.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildWomensWCPool(sqlite, {
        auctionId,
        tournamentId,
        teams,
      });

      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });

      // Auto-run valuation so prices are never left empty after a pool build.
      // Re-valuing only writes val_expected/efppm — never sold rows or purses —
      // so this is safe even when teams are added to a live auction.
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- MLC 2026: build pool from announced squads in DB ----
    if (auctionRow.tournament_name === MLC_2026_NAME) {
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
             VALUES (?, 'CUSTOM', 'T20', 100, 18)`
          )
          .run(MLC_2026_NAME);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? MLC_2026.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildMLCPool(sqlite, { auctionId, tournamentId, teams });
      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- India vs England Men's T20 2026 (bilateral T20I series) ----
    if (auctionRow.tournament_name === IND_VS_ENG_T20_2026_NAME) {
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
             VALUES (?, 'BILATERAL', 'T20', 100, 17)`
          )
          .run(IND_VS_ENG_T20_2026_NAME);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? IND_VS_ENG_T20_2026.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildBilateralT20Pool(sqlite, { auctionId, tournamentId, teams });
      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- Ireland vs West Indies Women's ODI 2026 (women's ODI bilateral) ----
    if (auctionRow.tournament_name === IRE_VS_WI_W_ODI_2026_NAME) {
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
             VALUES (?, 'BILATERAL', 'ODI', 100, 14)`
          )
          .run(IRE_VS_WI_W_ODI_2026_NAME);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? IRE_VS_WI_W_ODI_2026.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildWomensOdiPool(sqlite, { auctionId, tournamentId, teams });
      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- New Zealand vs West Indies Men's ODI 2026 (men's ODI bilateral) ----
    if (auctionRow.tournament_name === NZ_VS_WI_MEN_ODI_2026_NAME) {
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
             VALUES (?, 'BILATERAL', 'ODI', 100, 16)`
          )
          .run(NZ_VS_WI_MEN_ODI_2026_NAME);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? NZ_VS_WI_MEN_ODI_2026.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildMensOdiPool(sqlite, { auctionId, tournamentId, teams });
      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- The Hundred 2026 (Men / Women) — franchise league on the D11 Hundred scale ----
    if (
      auctionRow.tournament_name === THE_HUNDRED_MEN_2026_NAME ||
      auctionRow.tournament_name === THE_HUNDRED_WOMEN_2026_NAME
    ) {
      const isWomen = auctionRow.tournament_name === THE_HUNDRED_WOMEN_2026_NAME;
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size)
             VALUES (?, 'CUSTOM', 'T20', 100, 16)`
          )
          .run(auctionRow.tournament_name);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      const allTeams = isWomen ? HUNDRED_WOMEN_2026 : HUNDRED_MEN_2026;
      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? allTeams.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildHundredPool(sqlite, {
        auctionId,
        tournamentId,
        gender: isWomen ? "female" : "male",
        teams,
      });
      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- LPL 2026 (Lanka Premier League) — franchise T20, modelled like MLC ----
    if (auctionRow.tournament_name === LPL_2026_NAME) {
      let tournamentId = auctionRow.tournament_id;
      if (!tournamentId) {
        const t = sqlite
          .prepare(
            `INSERT INTO tournaments (name, format, match_format, purse_per_team, max_squad_size, max_overseas)
             VALUES (?, 'CUSTOM', 'T20', 100, 18, 4)`
          )
          .run(LPL_2026_NAME);
        tournamentId = Number(t.lastInsertRowid);
        sqlite
          .prepare("UPDATE auctions SET tournament_id = ? WHERE id = ?")
          .run(tournamentId, auctionId);
      }

      const teams = Array.isArray(teamsFilter) && teamsFilter.length
        ? LPL_2026.filter((t) => teamsFilter.includes(t.short))
        : undefined;

      const built = buildLPLPool(sqlite, { auctionId, tournamentId, teams });
      if (isFirstBuild)
        carryOverPreviousLineups({
          tournamentName: auctionRow.tournament_name,
          tournamentId,
          auctionId,
        });
      initializeValuations(tournamentId);

      return NextResponse.json({
        success: true,
        teams: built.teams,
        players: built.players,
        matched: built.matched,
        created: built.created,
        unmatched: built.unmatched,
        teamBreakdown: built.teamBreakdown,
      });
    }

    // ---- Default: IPL squads scraped from iplt20.com ----
    // Fetch squads from iplt20.com
    const teams = await fetchAllIPLSquads();

    // Get all existing players for fuzzy matching
    const existingPlayers = db
      .select({ id: players.id, name: players.name })
      .from(players)
      .all();

    // Build name→id lookup
    const nameMap = new Map<string, number>();
    for (const p of existingPlayers) {
      nameMap.set(normalizeName(p.name), p.id);
    }

    // Use or create a tournament for this auction
    let tournamentId = auctionRow.tournament_id;
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

    let totalPlayers = 0;
    let matched = 0;
    let created = 0;

    const insertPool = sqlite.prepare(
      `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm)
       VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?)`
    );

    const insertPlayer = sqlite.prepare(
      `INSERT INTO players (name, country, role, is_overseas)
       VALUES (?, ?, ?, ?)`
    );

    // Get EFPPM from career stats
    const getEfppm = sqlite.prepare(
      `SELECT avg_fantasy_points FROM career_stats
       WHERE player_id = ? AND format IN ('IPL', 'T20')
       ORDER BY CASE format WHEN 'IPL' THEN 1 WHEN 'T20' THEN 2 END
       LIMIT 1`
    );

    const transaction = sqlite.transaction(
      (teamsData: ScrapedTeam[]) => {
        for (const team of teamsData) {
          for (const player of team.players) {
            totalPlayers++;

            // Try to match player to existing DB
            let playerId = findPlayerId(player, nameMap);

            if (playerId) {
              matched++;
            } else {
              // Create new player
              const result = insertPlayer.run(
                player.name,
                player.country,
                player.role,
                player.isOverseas ? 1 : 0
              );
              playerId = Number(result.lastInsertRowid);
              nameMap.set(normalizeName(player.name), playerId);
              created++;
            }

            // Get EFPPM from career stats
            const efppmRow = getEfppm.get(playerId) as {
              avg_fantasy_points: number;
            } | undefined;
            const efppm = efppmRow?.avg_fantasy_points || 0;

            // Insert into auction pool
            insertPool.run(
              tournamentId,
              playerId,
              player.price || 0,
              auctionId,
              team.team,
              player.squadNumber,
              efppm
            );
          }
        }
      }
    );

    transaction(teams);

    if (isFirstBuild)
      carryOverPreviousLineups({
        tournamentName: auctionRow.tournament_name,
        tournamentId,
        auctionId,
      });

    // Auto-run valuation so prices are never left empty after a pool build.
    initializeValuations(tournamentId);

    return NextResponse.json({
      success: true,
      teams: teams.length,
      players: totalPlayers,
      matched,
      created,
      teamBreakdown: teams.map((t) => ({
        team: t.team,
        name: t.teamFullName,
        playerCount: t.players.length,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Pool fetch error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function findPlayerId(
  player: ScrapedPlayer,
  nameMap: Map<string, number>
): number | null {
  const normalized = normalizeName(player.name);

  // Exact match
  if (nameMap.has(normalized)) {
    return nameMap.get(normalized)!;
  }

  // Try partial matching — last name + first initial
  const parts = normalized.split(" ");
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const firstInitial = parts[0][0];

    for (const [key, id] of nameMap) {
      const keyParts = key.split(" ");
      if (keyParts.length >= 2) {
        const keyLast = keyParts[keyParts.length - 1];
        const keyFirst = keyParts[0][0];
        if (keyLast === lastName && keyFirst === firstInitial) {
          return id;
        }
      }
    }
  }

  return null;
}

/**
 * Replicate the user's lineup edits into repeat auctions of the SAME tour.
 *
 * The user tweaks each auction's Playing-XI order (`squad_number`) by feel, and
 * wants those tweaks to carry forward when they spin up another auction of the
 * same tournament — instead of resetting to the squad-file default order.
 *
 * Copies ONLY `squad_number`, and only for players present in BOTH pools. It
 * never touches sold status / price / purses (those are per-auction). Players
 * new to this edition (swaps / additions) keep their squad-file default slot.
 * Callers gate this to a FRESH pool build (first fetch for the auction) so it
 * can never clobber a live or hand-edited auction.
 *
 * "Previous" = the most recent EARLIER auction of the same tournament_name that
 * has a pool built, so each new auction inherits the latest accumulated edits.
 */
function carryOverPreviousLineups(opts: {
  tournamentName: string;
  tournamentId: number;
  auctionId: number;
}): { sourceAuctionId: number | null; updated: number } {
  const { tournamentName, tournamentId, auctionId } = opts;

  const prev = sqlite
    .prepare(
      `SELECT a.id AS auction_id, a.tournament_id AS tournament_id
         FROM auctions a
        WHERE a.tournament_name = ?
          AND a.id <> ?
          AND a.tournament_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM auction_pool p WHERE p.tournament_id = a.tournament_id
          )
        ORDER BY a.id DESC
        LIMIT 1`
    )
    .get(tournamentName, auctionId) as
    | { auction_id: number; tournament_id: number }
    | undefined;

  if (!prev) return { sourceAuctionId: null, updated: 0 };

  const res = sqlite
    .prepare(
      `UPDATE auction_pool
          SET squad_number = (
            SELECT prev.squad_number FROM auction_pool prev
             WHERE prev.tournament_id = ?
               AND prev.player_id = auction_pool.player_id
          )
        WHERE tournament_id = ?
          AND EXISTS (
            SELECT 1 FROM auction_pool prev
             WHERE prev.tournament_id = ?
               AND prev.player_id = auction_pool.player_id
          )`
    )
    .run(prev.tournament_id, tournamentId, prev.tournament_id);

  console.log(
    `[pool/fetch] Carried over ${res.changes} lineup slot(s) from auction ${prev.auction_id} (${tournamentName})`
  );
  return { sourceAuctionId: prev.auction_id, updated: res.changes };
}
