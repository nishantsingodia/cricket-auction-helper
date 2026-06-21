import type Database from "better-sqlite3";
import { MLC_2026, MLC_NAME_ALIASES, mlcRiskNote, type MLCTeam } from "./mlc-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for MLC 2026 from the announced squads. MLC is a
// multinational franchise league, so we can't scope matching by country like the
// women's WC. Instead we match each squad player to a DB player in two passes:
//   1. players who have MLC career_stats (most reliable — same league, disambiguates)
//   2. otherwise any male player with IPL/T20 history (internationals making their
//      MLC debut, e.g. R Ashwin)
// Unmatched players (true 2026 newcomers / USA draftees with no prior data) are
// created fresh with no stats (they price near baseline).

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

function matchPlayer(squadName: string, pools: DbPlayer[][]): number | null {
  // Registry-FIRST: deterministic cricsheet_id identity from the shared global registry
  // (same identity the points sheet & draft use), before any fuzzy logic.
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    for (const pool of pools) {
      const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
      if (byCs) return byCs.id;
    }
  }
  const alias = MLC_NAME_ALIASES[normName(squadName)];
  // An alias is an EXACT DB spelling — match it exactly (across all pools)
  // before any fuzzy logic. Otherwise the generic matcher's surname-only
  // fallback can grab a same-surname player with different initials that
  // happens to sit in an earlier pool (e.g. "LG Pretorius" → "D Pretorius").
  if (alias) {
    const target = normName(alias);
    for (const pool of pools) {
      const hit = pool.find((p) => normName(p.name) === target);
      if (hit) return hit.id;
    }
  }
  const resolved = alias ?? squadName;
  for (const pool of pools) {
    const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
    if (match !== null) return pool.find((p) => p.name === match)?.id ?? null;
  }
  return null;
}

export function buildMLCPool(
  sqlite: Database.Database,
  opts: { auctionId: number; tournamentId: number; teams?: MLCTeam[] }
): BuildResult {
  const teams = opts.teams ?? MLC_2026;

  const insertPool = sqlite.prepare(
    `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)`
  );
  const updateIsOverseas = sqlite.prepare(
    `UPDATE players SET is_overseas = ? WHERE id = ?`
  );
  const insertPlayer = sqlite.prepare(
    `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, 'MLC', ?, ?, 'male')`
  );
  // Initial efppm hint (engine recomputes the real blended value on auction/start).
  const getEfppm = sqlite.prepare(
    `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('MLC','IPL','T20')
     ORDER BY CASE format WHEN 'MLC' THEN 1 WHEN 'IPL' THEN 2 ELSE 3 END
     LIMIT 1`
  );

  // Pass-1 pool: players with MLC history. Pass-2 pool: men with IPL/T20 history.
  const mlcPool = sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id AND cs.format = 'MLC'`
    )
    .all() as DbPlayer[];
  const broadPool = sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id AND cs.format IN ('IPL','T20')
       WHERE p.gender != 'female' OR p.gender IS NULL`
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
        let playerId = matchPlayer(sp.name, [mlcPool, broadPool]);
        if (playerId) {
          result.matched++;
          // Stamp MLC-context overseas flag — players table may reflect IPL context
          updateIsOverseas.run(sp.overseas ? 1 : 0, playerId);
        } else {
          const ins = insertPlayer.run(sp.name, sp.role, sp.overseas ? 1 : 0);
          playerId = Number(ins.lastInsertRowid);
          result.created++;
          result.unmatched.push({ team: team.short, name: sp.name });
          mlcPool.push({ id: playerId, name: sp.name, cricsheetId: null }); // avoid re-creating dupes
        }

        const efppmRow = getEfppm.get(playerId) as { avg_fantasy_points: number } | undefined;
        const sn = squadNumber++;
        insertPool.run(
          opts.tournamentId, playerId, 0, opts.auctionId,
          team.short, sn, efppmRow?.avg_fantasy_points || 0, mlcRiskNote(team.short, sn)
        );
      }
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  transaction();
  return result;
}
