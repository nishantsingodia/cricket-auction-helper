import { withTransaction, type DbHandle } from "@/db";
import {
  ETPL_2026,
  ETPL_CRICSHEET_IDS,
  ETPL_NAME_ALIASES,
  ETPL_NO_DB_RECORD,
  type ETPLTeam,
} from "./etpl-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for ETPL 2026 from the announced squads. Same two-pass shape as the CPL
// builder, and the reasoning for that shape applies with more force here than anywhere else.
//
// ETPL is a multinational league (host-nation core from NED/SCO/IRE + associates + up to 7 Full
// Member overseas), so matching cannot be scoped by country. Candidate pools:
//   1. players with Vitality Blast or Hundred career_stats — the closest thing to an "in-league"
//      pool that exists for a first-season competition, and where most of this squad's professional
//      cricket is actually recorded. There is no ETPL history to key off.
//   2. otherwise any male with T20I or marquee-franchise-T20 history — needed because the Dutch and
//      Scottish contingent's entire record is associate T20Is, and the overseas signings' records
//      live in IPL/BBL/SA20/PSL/CPL.
// Unmatched players (uncapped draft picks with no ball-by-ball anywhere) are created statless. They
// land on their role prior under ETPL's shrinkage, which is the honest answer for them.
//
// WHY THE CLAIMED-SET / TWO-PASS MATTERS SO MUCH HERE: this pool contains more same-surname pairs
// than any other tour in the app, and in several cases one man has 150+ matches and the other has
// under 10 — exactly the shape that lets fuzzy hand a teenager a star's career:
//   Tim Tector (8m)      vs Harry Tector (153m)      — different teams, both in the pool
//   Ross Adair (23m)     vs Mark Adair (174m)        — brothers, different teams
//   Alexander Roy (2m)   vs Jason Roy (England)      — different teams
//   Kyle Klein / Ryan Klein / Fred Klaassen          — three near-identical surnames
//   Jasper Davidson / Oliver Davidson                — different teams
//   Ben Manenti / Harry Manenti                      — different teams
// Plus three cross-pool traps where fuzzy would reach OUTSIDE the squad entirely: Ali Hasan (Italy,
// 10m) -> Hasan Ali (Pakistan, 318m), Ali Khan (USA) -> Rashid Khan, Harmeet Singh (USA) ->
// Harbhajan Singh. All of them are pinned in ETPL_NAME_ALIASES.
//   Pass A — deterministic identity (EXACT curated alias, then registry cricsheet_id) for ALL
//            players first, so the right man claims his record before fuzzy runs at all.
//   Pass B — fuzzy, only for whoever is still unresolved.
// A player_id already CLAIMED is never reused; the loser of a clash is created statless rather than
// silently dropped by INSERT OR IGNORE, so every squad member stays biddable.

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

// Pass A: deterministic identity only. Alias BEFORE registry, same as the CPL builder — the aliases
// here are hand-verified against the DB (name + country + career match count checked one by one),
// and a curated verified mapping should beat a machine-built one that may contain merges.
function resolveExact(squadName: string, pools: DbPlayer[][]): number | null {
  // Cricsheet id FIRST — it is the only identifier that is actually unique. A name alias cannot
  // separate two DB rows that share a name (see ETPL_CRICSHEET_IDS for the one case that matters).
  const csId = ETPL_CRICSHEET_IDS[normName(squadName)];
  if (csId) {
    for (const pool of pools) {
      const found = pool.find((p) => p.cricsheetId === csId);
      if (found) return found.id;
    }
  }
  const alias = ETPL_NAME_ALIASES[normName(squadName)];
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

// Pass B: fuzzy (surname/initial strategies). The alias string, if present, is fuzzed too.
function resolveFuzzy(squadName: string, pools: DbPlayer[][]): number | null {
  // Known to have no record of his own — never let fuzzy hand him someone else's career.
  if (ETPL_NO_DB_RECORD[normName(squadName)]) return null;
  const resolved = ETPL_NAME_ALIASES[normName(squadName)] ?? squadName;
  for (const pool of pools) {
    const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
    if (match !== null) return pool.find((p) => p.name === match)?.id ?? null;
  }
  return null;
}

// Candidate pools, exported so the setup/verification scripts resolve identically to the build.
export async function etplCandidatePools(sqlite: DbHandle): Promise<DbPlayer[][]> {
  // Tier 1 — Blast/Hundred players. Stands in for the missing "in-league" pool: a first-season
  // competition has no history, and English domestic T20 is where most of this squad plays.
  const euroPool = await sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id AND cs.format IN ('BLAST','HUN')
       WHERE p.gender != 'female' OR p.gender IS NULL`
    )
    .all() as DbPlayer[];
  // Tier 2 — anyone with T20I or marquee-franchise-T20 history. 'T20' is FIRST-CLASS here, unlike
  // the CPL builder: without it the entire Dutch/Scottish/Irish/associate contingent (whose record
  // is associate T20Is and nothing else) would not even be a candidate and would be created as
  // statless phantoms despite having 80-200 recorded matches.
  const broadPool = await sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN career_stats cs ON cs.player_id = p.id
         AND cs.format IN ('T20','BLAST','HUN','IPL','BBL','PSL','SA20','ILT20','CPL','LPL','MLC')
       WHERE p.gender != 'female' OR p.gender IS NULL`
    )
    .all() as DbPlayer[];
  return [euroPool, broadPool];
}

// Resolve the whole squad list to player ids. Exported and side-effect free so a dry run can print
// the mapping BEFORE any DB write — worth doing on this pool given the surname traps above.
export async function resolveEtplSquads(
  sqlite: DbHandle,
  teams: ETPLTeam[] = ETPL_2026
): Promise<Array<{
  team: ETPLTeam;
  sp: ETPLTeam["players"][number];
  sn: number;
  playerId: number | null;
  via: "exact" | "fuzzy" | null;
}>> {
  const pools = await etplCandidatePools(sqlite);
  const rows: Array<{
    team: ETPLTeam;
    sp: ETPLTeam["players"][number];
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

export async function buildETPLPool(
  sqlite: DbHandle,
  opts: { auctionId: number; tournamentId: number; teams?: ETPLTeam[] }
): Promise<BuildResult> {
  const teams = opts.teams ?? ETPL_2026;

  const rows = await resolveEtplSquads(sqlite, teams);

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, created: 0, unmatched: [], teamBreakdown: [],
  };

  await withTransaction(async (tx) => {
    const insertPool = tx.prepare(
      `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)`
    );
    // is_overseas is stamped FROM THE SQUAD FILE, never trusted from the DB: the DB flag reflects
    // whatever context the player was last ingested in, and ETPL's definition is unique — it means
    // "counts against the 4-man Test-nation XI cap", so every Irish, Dutch, Scottish and ASSOCIATE
    // player is domestic here even though most of them are overseas in every other league we run.
    const updateIsOverseas = tx.prepare(`UPDATE players SET is_overseas = ? WHERE id = ?`);
    const insertPlayer = tx.prepare(
      `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, 'ETPL', ?, ?, 'male')`
    );
    // Initial efppm hint only (the engine recomputes the real blended value on auction/start).
    // Blast/Hundred first, then T20 — matching the candidate-pool priority.
    const getEfppm = tx.prepare(
      `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('BLAST','HUN','T20','IPL')
     ORDER BY CASE format WHEN 'BLAST' THEN 1 WHEN 'HUN' THEN 2 WHEN 'T20' THEN 3 ELSE 4 END
     LIMIT 1`
    );

    for (const r of rows) {
      result.players++;
      let playerId = r.playerId;
      if (playerId !== null) {
        result.matched++;
        await updateIsOverseas.run(r.sp.overseas ? 1 : 0, playerId);
      } else {
        const ins = await insertPlayer.run(r.sp.name, r.sp.role, r.sp.overseas ? 1 : 0);
        playerId = Number(ins.lastInsertRowid);
        result.created++;
        result.unmatched.push({ team: r.team.short, name: r.sp.name });
      }
      const efppmRow = (await getEfppm.get(playerId)) as { avg_fantasy_points: number } | undefined;
      await insertPool.run(
        opts.tournamentId, playerId, 0, opts.auctionId,
        r.team.short, r.sn, efppmRow?.avg_fantasy_points || 0, r.sp.note ?? ""
      );
    }
    for (const team of teams) {
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  return result;
}
