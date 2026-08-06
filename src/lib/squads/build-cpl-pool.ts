import type Database from "better-sqlite3";
import {
  CPL_2026,
  CPL_NAME_ALIASES,
  CPL_NO_DB_RECORD,
  cplAvailability,
  type CPLTeam,
} from "./cpl-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for CPL 2026 from the announced squads. Same shape as the LPL builder:
// CPL is a multinational franchise league (West Indian core + 5 overseas per squad), so matching
// can't be scoped by country. Two candidate pools:
//   1. players with CPL career_stats (most reliable — same league, disambiguates namesakes)
//   2. otherwise any male with marquee-franchise-T20 or T20I history (the overseas signings and
//      the WI internationals whose form lives in T20Is / other leagues)
// Unmatched players (uncapped Caribbean domestics and the "breakout" picks with no prior
// ball-by-ball) are created statless — they price near baseline, which is correct for them.
//
// TWO RESOLUTION PASSES + a CLAIMED SET. This matters more in CPL than anywhere else: the 2026
// squads are full of same-surname pairs where one man is a 500-match star and the other is an
// uncapped teenager — Kieron/Jakeem Pollard, Nicholas/Kamil Pooran, Ashmead/Darron Nedd,
// Kirk/Micah McKenzie, Alzarri/Shamar Joseph, Joshua Da Silva/Amshi de Silva.
//   Pass A — deterministic identity (registry cricsheet_id, then exact alias) for ALL players
//            first, so the star claims its record before fuzzy can hand it to the namesake.
//   Pass B — fuzzy, for whoever is still unresolved.
// A player_id already CLAIMED is never reused; the loser of a clash is created statless rather
// than silently dropped by INSERT OR IGNORE (so every squad member stays biddable).

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

// Pass A: deterministic identity only (EXACT curated alias, then registry cricsheet_id).
// NOTE the order is alias-BEFORE-registry, the reverse of the LPL/MLC builders. CPL_NAME_ALIASES is
// hand-verified against the DB (name + cricinfo id + career matches checked one by one), whereas the
// registry is machine-built and does contain merges — e.g. `ci:443150` claims both 'ka hope' and
// 'shai hope', so registry-first sends the 337-match Shai Hope to his brother Kyle's 11-match row.
// A curated, verified mapping should win over a generated one; the registry still covers everyone
// we haven't hand-checked.
function resolveExact(squadName: string, pools: DbPlayer[][]): number | null {
  const alias = CPL_NAME_ALIASES[normName(squadName)];
  if (alias) {
    const target = normName(alias);
    for (const pool of pools) {
      const found = pool.find((p) => normName(p.name) === target);
      if (found) return found.id;
    }
  }
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    for (const pool of pools) {
      const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
      if (byCs) return byCs.id;
    }
  }
  return null;
}

// Pass B: fuzzy (surname/initial strategies). Alias string, if present, is fuzzed too.
function resolveFuzzy(squadName: string, pools: DbPlayer[][]): number | null {
  // Known to have no record of his own — never let fuzzy hand him someone else's career.
  if (CPL_NO_DB_RECORD[normName(squadName)]) return null;
  const resolved = CPL_NAME_ALIASES[normName(squadName)] ?? squadName;
  for (const pool of pools) {
    const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
    if (match !== null) return pool.find((p) => p.name === match)?.id ?? null;
  }
  return null;
}

// Candidate pools, exported so the setup/verification scripts resolve identically to the build.
export function cplCandidatePools(sqlite: Database.Database): DbPlayer[][] {
  const cplPool = sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id AND cs.format = 'CPL'`
    )
    .all() as DbPlayer[];
  const broadPool = sqlite
    .prepare(
      // Any male with marquee-franchise-T20 or T20I history. Mirrors the valuation quality set —
      // a CPL overseas signing's form often lives entirely in PSL/BBL/SA20/LPL, and without those
      // formats here he isn't even a candidate and gets created as a statless phantom.
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id
         AND cs.format IN ('CPL','IPL','T20','BBL','PSL','LPL','SA20','ILT20','MLC','HUN')
       WHERE p.gender != 'female' OR p.gender IS NULL`
    )
    .all() as DbPlayer[];
  return [cplPool, broadPool];
}

// Resolve the whole squad list to player ids using the exact-then-fuzzy + claimed-set passes.
// Exported (and side-effect free) so a dry run can print the mapping BEFORE any DB write.
export function resolveCplSquads(
  sqlite: Database.Database,
  teams: CPLTeam[] = CPL_2026
): Array<{
  team: CPLTeam;
  sp: CPLTeam["players"][number];
  sn: number;
  playerId: number | null;
  via: "exact" | "fuzzy" | null;
}> {
  const pools = cplCandidatePools(sqlite);
  const rows: Array<{
    team: CPLTeam;
    sp: CPLTeam["players"][number];
    sn: number;
    playerId: number | null;
    via: "exact" | "fuzzy" | null;
  }> = [];
  for (const team of teams) {
    let sn = 1;
    for (const sp of team.players) rows.push({ team, sp, sn: sn++, playerId: null, via: null });
  }

  const claimed = new Set<number>();
  // Pass A — deterministic identity for everyone first.
  for (const r of rows) {
    const id = resolveExact(r.sp.name, pools);
    if (id !== null && !claimed.has(id)) {
      claimed.add(id);
      r.playerId = id;
      r.via = "exact";
    }
  }
  // Pass B — fuzzy for whoever is still unresolved; never reuse a claimed id.
  for (const r of rows) {
    if (r.playerId !== null) continue;
    const id = resolveFuzzy(r.sp.name, pools);
    if (id !== null && !claimed.has(id)) {
      claimed.add(id);
      r.playerId = id;
      r.via = "fuzzy";
    }
  }
  return rows;
}

export function buildCPLPool(
  sqlite: Database.Database,
  opts: { auctionId: number; tournamentId: number; teams?: CPLTeam[] }
): BuildResult {
  const teams = opts.teams ?? CPL_2026;

  const insertPool = sqlite.prepare(
    // `availability` is written here so the board's Availability panel and per-player badges light
    // up. Derived from the published phase windows (see cplAvailability), never hand-maintained.
    `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note, availability)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?, ?)`
  );
  const updateIsOverseas = sqlite.prepare(`UPDATE players SET is_overseas = ? WHERE id = ?`);
  const insertPlayer = sqlite.prepare(
    `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, 'CPL', ?, ?, 'male')`
  );
  // Initial efppm hint (engine recomputes the real blended value on auction/start).
  const getEfppm = sqlite.prepare(
    `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('CPL','IPL','T20')
     ORDER BY CASE format WHEN 'CPL' THEN 1 WHEN 'IPL' THEN 2 ELSE 3 END
     LIMIT 1`
  );

  const rows = resolveCplSquads(sqlite, teams);

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, created: 0, unmatched: [], teamBreakdown: [],
  };

  const transaction = sqlite.transaction(() => {
    for (const r of rows) {
      result.players++;
      let playerId = r.playerId;
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
      // Availability keys off the DB spelling, which is what the valuation engine uses too.
      const dbName =
        (sqlite.prepare(`SELECT name FROM players WHERE id = ?`).get(playerId) as { name: string })
          ?.name ?? r.sp.name;
      insertPool.run(
        opts.tournamentId, playerId, 0, opts.auctionId,
        r.team.short, r.sn, efppmRow?.avg_fantasy_points || 0, r.sp.note ?? "",
        cplAvailability(dbName)
      );
    }
    for (const team of teams) {
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  transaction();
  return result;
}
