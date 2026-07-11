import type Database from "better-sqlite3";
import {
  IRE_VS_WI_W_ODI_2026,
  IRE_WI_W_ODI_NAME_ALIASES,
  type OdiTeam,
} from "./ire-wi-w-odi-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for a women's ODI bilateral (Ireland vs West Indies 2026) from the
// announced squads. Mirrors the bilateral-T20 builder, but the matching pool is FEMALE players
// with ODI match data (the two teams are both women's sides), and the EFPPM hint reads ODI
// career stats. Three passes per squad name:
//   1. registry cricsheet_id (shared global identity — deterministic)
//   2. exact alias spelling (IRE_WI_W_ODI_NAME_ALIASES — for espn:/slug: registry pids)
//   3. fuzzy name (surname + initial)
// Unmatched (a genuinely uncapped newcomer) is created statless and prices near baseline.

interface DbPlayer {
  id: number;
  name: string;
  cricsheetId: string | null;
}

interface BuildResult {
  teams: number;
  players: number;
  matched: number;
  created: number;
  unmatched: { team: string; name: string }[];
  teamBreakdown: { team: string; name: string; playerCount: number }[];
}

function matchPlayer(squadName: string, pool: DbPlayer[]): number | null {
  // 1. Registry-FIRST: deterministic cricsheet_id identity.
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
    if (byCs) return byCs.id;
  }
  // 2. Exact alias spelling (the EXACT DB spelling, matched before any fuzzy logic).
  const alias = IRE_WI_W_ODI_NAME_ALIASES[normName(squadName)];
  if (alias) {
    const target = normName(alias);
    const exact = pool.find((p) => normName(p.name) === target);
    if (exact) return exact.id;
  }
  // 3. Fuzzy fallback.
  const resolved = alias ?? squadName;
  const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
  return match !== null ? pool.find((p) => p.name === match)?.id ?? null : null;
}

export function buildWomensOdiPool(
  sqlite: Database.Database,
  opts: { auctionId: number; tournamentId: number; teams?: OdiTeam[] }
): BuildResult {
  const teams = opts.teams ?? IRE_VS_WI_W_ODI_2026;

  const insertPool = sqlite.prepare(
    `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)`
  );
  const insertPlayer = sqlite.prepare(
    `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, ?, ?, 0, 'female')`
  );
  // Initial efppm hint (engine recomputes the real blended value on auction/start) — ODI stats.
  const getEfppm = sqlite.prepare(
    `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format = 'ODI'
     LIMIT 1`
  );

  // Matching pool: every FEMALE player with ODI match data (not career_stats — so a data-rich
  // player is never missed even if their career_stats row is absent).
  const pool = sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN match_performances mp ON mp.player_id = p.id AND mp.format = 'ODI'
       WHERE p.gender = 'female'`
    )
    .all() as DbPlayer[];

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, created: 0, unmatched: [], teamBreakdown: [],
  };

  const transaction = sqlite.transaction(() => {
    for (const team of teams) {
      let squadNumber = 1;
      for (const sp of team.players) {
        result.players++;
        let playerId = matchPlayer(sp.name, pool);
        if (playerId) {
          result.matched++;
        } else {
          const ins = insertPlayer.run(sp.name, team.country, sp.role);
          playerId = Number(ins.lastInsertRowid);
          result.created++;
          result.unmatched.push({ team: team.short, name: sp.name });
          pool.push({ id: playerId, name: sp.name, cricsheetId: null }); // avoid re-creating dupes
        }

        const efppmRow = getEfppm.get(playerId) as { avg_fantasy_points: number } | undefined;
        const sn = squadNumber++;
        insertPool.run(
          opts.tournamentId, playerId, 0, opts.auctionId,
          team.short, sn, efppmRow?.avg_fantasy_points || 0, sp.note ?? ""
        );
      }
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  transaction();
  return result;
}
