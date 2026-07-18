import type Database from "better-sqlite3";
import { LPL_2026, LPL_NAME_ALIASES, type LPLTeam } from "./lpl-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for LPL 2026 from the announced squads. LPL is a multinational
// franchise league (Sri Lanka core + overseas), so we can't scope matching by country like
// the women's WC. We match each squad player to a DB player in two passes:
//   1. players who have LPL career_stats (most reliable — same league, disambiguates)
//   2. otherwise any male player with LPL/IPL/T20 history (internationals + SL players whose
//      form lives in T20Is / the IPL)
// Unmatched players (true newcomers / uncapped domestics with no prior ball-by-ball) are
// created fresh with no stats (they price near baseline).
//
// TWO RESOLUTION PASSES + a CLAIMED SET (critical for SL squads — many share a surname AND
// first initial, e.g. Kusal/Kamindu Mendis, Angelo/Traveen Mathews, Pavan/Tharindu Rathnayake):
//   Pass A — deterministic identity (registry cricsheet_id, then exact-alias) for ALL players
//            first, so a star claims its record before fuzzy can hand it to a fringe namesake.
//   Pass B — fuzzy, for whoever is still unresolved.
// A player_id already CLAIMED is never reused; the loser of a clash is created statless instead
// of being silently dropped by INSERT OR IGNORE (so every squad member stays biddable).

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

// Pass A: deterministic identity only (registry cricsheet_id, then EXACT alias spelling).
function resolveExact(squadName: string, pools: DbPlayer[][]): number | null {
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    for (const pool of pools) {
      const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
      if (byCs) return byCs.id;
    }
  }
  const alias = LPL_NAME_ALIASES[normName(squadName)];
  if (alias) {
    const target = normName(alias);
    for (const pool of pools) {
      const found = pool.find((p) => normName(p.name) === target);
      if (found) return found.id;
    }
  }
  return null;
}

// Pass B: fuzzy (surname/initial strategies). Alias string, if present, is fuzzed too.
function resolveFuzzy(squadName: string, pools: DbPlayer[][]): number | null {
  const resolved = LPL_NAME_ALIASES[normName(squadName)] ?? squadName;
  for (const pool of pools) {
    const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
    if (match !== null) return pool.find((p) => p.name === match)?.id ?? null;
  }
  return null;
}

export function buildLPLPool(
  sqlite: Database.Database,
  opts: { auctionId: number; tournamentId: number; teams?: LPLTeam[] }
): BuildResult {
  const teams = opts.teams ?? LPL_2026;

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
     VALUES (?, 'LPL', ?, ?, 'male')`
  );
  // Initial efppm hint (engine recomputes the real blended value on auction/start).
  const getEfppm = sqlite.prepare(
    `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('LPL','IPL','T20')
     ORDER BY CASE format WHEN 'LPL' THEN 1 WHEN 'IPL' THEN 2 ELSE 3 END
     LIMIT 1`
  );

  // Pass-1 pool: players with LPL history. Pass-2 pool: men with LPL/IPL/T20 history.
  const lplPool = sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id AND cs.format = 'LPL'`
    )
    .all() as DbPlayer[];
  const broadPool = sqlite
    .prepare(
      // Candidate pool = any male with marquee-franchise-T20 or T20I history. Must include the
      // OTHER franchise leagues (BBL/PSL/CPL/SA20/ILT20/MLC/HUN), not just LPL/IPL/T20 — many LPL
      // signings are franchise journeymen (e.g. SB Harper, all BBL/PSL) who otherwise aren't even
      // candidates and get created as statless phantoms. Mirrors the valuation quality set.
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id
         AND cs.format IN ('LPL','IPL','T20','BBL','PSL','CPL','SA20','ILT20','MLC','HUN')
       WHERE p.gender != 'female' OR p.gender IS NULL`
    )
    .all() as DbPlayer[];
  const pools = [lplPool, broadPool];

  // Flatten squad -> ordered rows (team order preserved; squad_number per team).
  const rows: Array<{ team: LPLTeam; sp: LPLTeam["players"][number]; sn: number }> = [];
  for (const team of teams) {
    let sn = 1;
    for (const sp of team.players) rows.push({ team, sp, sn: sn++ });
  }

  const claimed = new Set<number>();
  const assignedId = new Array<number | null>(rows.length).fill(null);

  // Pass A — deterministic identity for everyone first.
  rows.forEach((r, i) => {
    const id = resolveExact(r.sp.name, pools);
    if (id !== null && !claimed.has(id)) {
      claimed.add(id);
      assignedId[i] = id;
    }
  });
  // Pass B — fuzzy for whoever is still unresolved; never reuse a claimed id.
  rows.forEach((r, i) => {
    if (assignedId[i] !== null) return;
    const id = resolveFuzzy(r.sp.name, pools);
    if (id !== null && !claimed.has(id)) {
      claimed.add(id);
      assignedId[i] = id;
    }
  });

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, created: 0, unmatched: [], teamBreakdown: [],
  };

  const transaction = sqlite.transaction(() => {
    rows.forEach((r, i) => {
      result.players++;
      let playerId = assignedId[i];
      if (playerId !== null) {
        result.matched++;
        updateIsOverseas.run(r.sp.overseas ? 1 : 0, playerId);
      } else {
        const ins = insertPlayer.run(r.sp.name, r.sp.role, r.sp.overseas ? 1 : 0);
        playerId = Number(ins.lastInsertRowid);
        result.created++;
        result.unmatched.push({ team: r.team.short, name: r.sp.name });
      }
      const efppmRow = getEfppm.get(playerId) as { avg_fantasy_points: number } | undefined;
      insertPool.run(
        opts.tournamentId, playerId, 0, opts.auctionId,
        r.team.short, r.sn, efppmRow?.avg_fantasy_points || 0, r.sp.note ?? ""
      );
    });
    for (const team of teams) {
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  transaction();
  return result;
}
