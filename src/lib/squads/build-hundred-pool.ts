import type Database from "better-sqlite3";
import {
  HUNDRED_MEN_2026,
  HUNDRED_WOMEN_2026,
  HUNDRED_NAME_ALIASES,
  type HundredTeam,
} from "./the-hundred-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for a The Hundred competition (men's or women's) from the announced
// 2026 squads. Country-agnostic matching (registry cricsheet_id -> exact alias -> fuzzy), like
// MLC — English domestic players often sit in the DB under cricsheet initials with country
// "Unknown", so we never scope by country. Pool is scoped by GENDER + formats the player could
// have data in. Genuinely uncapped domestic newcomers are created statless (price near baseline).

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
  // 2. exact alias spelling
  const alias = HUNDRED_NAME_ALIASES[normName(squadName)];
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

export function buildHundredPool(
  sqlite: Database.Database,
  opts: {
    auctionId: number;
    tournamentId: number;
    gender: "male" | "female";
    teams?: HundredTeam[];
  }
): BuildResult {
  const isWomen = opts.gender === "female";
  const teams = opts.teams ?? (isWomen ? HUNDRED_WOMEN_2026 : HUNDRED_MEN_2026);

  const insertPool = sqlite.prepare(
    `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)`
  );
  const updateIsOverseas = sqlite.prepare(`UPDATE players SET is_overseas = ? WHERE id = ?`);
  const insertPlayer = sqlite.prepare(
    `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, 'Hundred', ?, ?, ?)`
  );
  // Initial efppm hint (engine recomputes the real normalized value on auction/start).
  const getEfppm = sqlite.prepare(
    `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN ('HUN','T20','IPL','WPL','MLC')
     ORDER BY CASE format WHEN 'HUN' THEN 1 WHEN 'T20' THEN 2 ELSE 3 END
     LIMIT 1`
  );

  // Matching pool: players of this GENDER with data in a Hundred-relevant format.
  const genderClause = isWomen
    ? "p.gender = 'female'"
    : "(p.gender != 'female' OR p.gender IS NULL)";
  const formatList = isWomen ? "'HUN','WPL','T20'" : "'HUN','T20','IPL','MLC'";
  const pool = sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN match_performances mp ON mp.player_id = p.id AND mp.format IN (${formatList})
       WHERE ${genderClause}`
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
          updateIsOverseas.run(sp.overseas ? 1 : 0, playerId);
        } else {
          const ins = insertPlayer.run(sp.name, sp.role, sp.overseas ? 1 : 0, opts.gender);
          playerId = Number(ins.lastInsertRowid);
          result.created++;
          result.unmatched.push({ team: team.short, name: sp.name });
          pool.push({ id: playerId, name: sp.name, cricsheetId: null });
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
