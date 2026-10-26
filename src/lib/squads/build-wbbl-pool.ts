import { withTransaction, type DbHandle } from "@/db";
import {
  WBBL_2026,
  WBBL_NAME_ALIASES,
  WBBL_NO_DB_RECORD,
  wbblAvailability,
  type WbblTeam,
} from "./wbbl-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for WBBL|12 2026 from the announced squads (CA squad tracker + club
// previews). Same shape as the WCPL builder: country-agnostic matching (registry cricsheet_id ->
// exact alias -> fuzzy), women-only (hard `gender = 'female'` filter).
//
// ⚠️ The gender filter is NOT the disambiguator. The traps in WBBL_NAME_ALIASES are woman-vs-
// woman (Sam Bates vs Suzie Bates, Linsey vs Lauren vs Amy Smith, Dani vs Maisy Gibson), which is
// why the EXACT-alias pass exists and its values are literal DB spellings.
//
// The CANDIDATE pool (identity only) is wider than the valuation quality set: HUN / WCPL / BLAST
// are where the English bench and young Australians have their only records, and a player with
// no candidate row is created statless even when her real record exists. Valuation still reads
// only the engine's quality list.

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

// Matching pool: FEMALE players with data in any women's format we hold (see header).
async function wbblCandidatePool(sqlite: DbHandle): Promise<DbPlayer[]> {
  return (await sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN match_performances mp ON mp.player_id = p.id AND mp.format IN ('WBBL','WPL','T20','HUN','WCPL','BLAST')
       WHERE p.gender = 'female'`
    )
    .all()) as DbPlayer[];
}

function matchPlayer(squadName: string, pool: DbPlayer[]): number | null {
  // 0. verified newcomers — never let fuzzy give them a namesake's record (see WBBL_NO_DB_RECORD)
  if (WBBL_NO_DB_RECORD.has(normName(squadName))) return null;
  // 1. registry cricsheet_id
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
    if (byCs) return byCs.id;
  }
  // 2. exact alias spelling — the load-bearing pass for this squad (the alias values are the
  // literal DB names, hand-verified against format history on 4 Sep 2026).
  const alias = WBBL_NAME_ALIASES[normName(squadName)];
  if (alias) {
    const target = normName(alias);
    const exact = pool.find((p) => normName(p.name) === target);
    if (exact) return exact.id;
  }
  // 3. fuzzy
  const resolved = alias ?? squadName;
  const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
  return match !== null ? pool.find((p) => p.name === match)?.id ?? null : null;
}

// Squad entry -> DB player id, resolved EXACTLY as the builder does. Split out so
// /api/pool/refresh-meta can push an availability correction into an already-built (or live)
// pool without rebuilding it — rebuilding is never safe once anything is sold. Returns
// playerId: null for the uncapped locals that have no DB record yet; the builder creates them,
// refresh-meta skips them.
export async function resolveWbblSquads(
  sqlite: DbHandle,
  teams: WbblTeam[] = WBBL_2026
): Promise<Array<{
  team: WbblTeam;
  sp: WbblTeam["players"][number];
  sn: number;
  playerId: number | null;
}>> {
  const pool = await wbblCandidatePool(sqlite);
  const rows: Array<{
    team: WbblTeam;
    sp: WbblTeam["players"][number];
    sn: number;
    playerId: number | null;
  }> = [];
  for (const team of teams) {
    let sn = 1;
    for (const sp of team.players) {
      rows.push({ team, sp, sn: sn++, playerId: matchPlayer(sp.name, pool) });
    }
  }
  return rows;
}

export async function buildWBBLPool(
  sqlite: DbHandle,
  opts: {
    auctionId: number;
    tournamentId: number;
    teams?: WbblTeam[];
  }
): Promise<BuildResult> {
  const teams = opts.teams ?? WBBL_2026;

  const pool = await wbblCandidatePool(sqlite);

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, created: 0, unmatched: [], teamBreakdown: [],
  };

  await withTransaction(async (tx) => {
    const insertPool = tx.prepare(
      `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note, availability, news_notes)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateIsOverseas = tx.prepare(`UPDATE players SET is_overseas = ? WHERE id = ?`);
    const insertPlayer = tx.prepare(
      `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, 'WBBL', ?, ?, 'female')`
    );
    // Initial efppm hint (engine recomputes the real normalized value on auction/start).
    // Same-league form first, then WPL, then women's T20Is.
    const getEfppm = tx.prepare(
      `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('WBBL','WPL','T20')
     ORDER BY CASE format WHEN 'WBBL' THEN 1 WHEN 'WPL' THEN 2 ELSE 3 END
     LIMIT 1`
    );

    for (const team of teams) {
      let squadNumber = 1;
      for (const sp of team.players) {
        result.players++;
        let playerId = matchPlayer(sp.name, pool);
        if (playerId) {
          result.matched++;
          await updateIsOverseas.run(sp.overseas ? 1 : 0, playerId);
        } else {
          const ins = await insertPlayer.run(sp.name, sp.role, sp.overseas ? 1 : 0);
          playerId = Number(ins.lastInsertRowid);
          result.created++;
          result.unmatched.push({ team: team.short, name: sp.name });
          pool.push({ id: playerId, name: sp.name, cricsheetId: null });
        }

        const efppmRow = (await getEfppm.get(playerId)) as { avg_fantasy_points: number } | undefined;
        const sn = squadNumber++;
        // Availability rides in two columns: the coarse enum the board's Availability Panel reads,
        // and the reason as a news note. risk_note keeps carrying every seed note regardless
        // (overseas-cap benchings, thin-sample warnings) for the player modal.
        const dbAvail = wbblAvailability(sp.name);
        const newsNote = sp.avail ? (sp.note ?? "") : "";
        await insertPool.run(
          opts.tournamentId, playerId, 0, opts.auctionId,
          team.short, sn, efppmRow?.avg_fantasy_points || 0, sp.note ?? "", dbAvail, newsNote
        );
      }
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  return result;
}
