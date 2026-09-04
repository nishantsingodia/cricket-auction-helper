import { withTransaction, type DbHandle } from "@/db";
import {
  WCPL_2026,
  WCPL_NAME_ALIASES,
  type WcplTeam,
} from "./wcpl-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for WCPL 2026 from the announced squads + local-player draft.
// Country-agnostic matching (registry cricsheet_id -> exact alias -> fuzzy), like the Hundred
// builder: the Caribbean locals sit in the DB under cricsheet initials ("Q Joseph",
// "RMAU Grimmond") and the overseas signings under theirs, so scoping by country would only
// lose rows. There is NO gender option — the WCPL is women-only, so the pool is hard-filtered
// to `gender = 'female'` rather than parameterised.
//
// ⚠️ The gender filter is NOT the disambiguator here. Every trap in WCPL_NAME_ALIASES is a
// woman-vs-woman clash (Suzie Bates vs the Australian bowler SL Bates; Stafanie Taylor vs the
// England keeper SJ Taylor), which is why the EXACT-alias pass exists and why its values are
// literal DB spellings — see the alias block in wcpl-2026.ts.
//
// Uncapped local draft picks (the Wilmott / Jairam / Harricharan tier) have no ball-by-ball
// record anywhere and are created statless — they price near baseline, which is correct.

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
  // 1. registry cricsheet_id
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
    if (byCs) return byCs.id;
  }
  // 2. exact alias spelling — the load-bearing pass for this squad (the alias values are the
  // literal DB names, hand-verified against format history on 4 Sep 2026).
  const alias = WCPL_NAME_ALIASES[normName(squadName)];
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

export async function buildWCPLPool(
  sqlite: DbHandle,
  opts: {
    auctionId: number;
    tournamentId: number;
    teams?: WcplTeam[];
  }
): Promise<BuildResult> {
  const teams = opts.teams ?? WCPL_2026;

  // Matching pool: FEMALE players with data in a WCPL-relevant format. WCPL is the league itself;
  // WPL/WBBL carry the overseas signings (Lanning, Harris, Kapp, Penna) and T20 carries the
  // internationals — women's T20Is share `format='T20'` with the men's and are separated only by
  // players.gender, which is exactly what the WHERE clause below is for.
  const pool = await sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN match_performances mp ON mp.player_id = p.id AND mp.format IN ('WCPL','WPL','T20','WBBL')
       WHERE p.gender = 'female'`
    )
    .all() as DbPlayer[];

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
     VALUES (?, 'WCPL', ?, ?, 'female')`
    );
    // Initial efppm hint (engine recomputes the real normalized value on auction/start).
    // Same-league form first, then the two women's franchise leagues, then T20 — a player's WCPL
    // number is the closest thing to a prior for a WCPL game.
    const getEfppm = tx.prepare(
      `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('WCPL','WPL','T20','WBBL')
     ORDER BY CASE format WHEN 'WCPL' THEN 1 WHEN 'WPL' THEN 2 WHEN 'WBBL' THEN 3 ELSE 4 END
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
        // WcplSquadPlayer has no `avail` flag — nobody in these squads is flagged out or late,
        // so everyone is FIT with an empty news note. The seed `note` still rides along in
        // risk_note (the overseas-cap benchings, the thin-sample warnings) for the player modal.
        await insertPool.run(
          opts.tournamentId, playerId, 0, opts.auctionId,
          team.short, sn, efppmRow?.avg_fantasy_points || 0, sp.note ?? "", "FIT", ""
        );
      }
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  return result;
}
