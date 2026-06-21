import type Database from "better-sqlite3";
import { WOMENS_T20_WC_2026, type WCTeam } from "./womens-t20-wc-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for the Women's T20 World Cup 2026 from the
// statically-stored announced squads, matching each player to an existing
// female player in the DB (so career stats / EFPPM carry over). Unmatched
// players are created fresh with no stats.

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

// Announced-name aliases for players whose cricsheet record uses a completely
// different name (marriages with full surname change, alternate family names).
// Key: normName(announcedName). Value: the DB player's original name string.
const NAME_ALIASES: Record<string, string> = {
  // Chamari Athapaththu is recorded in cricsheet as "AC Jayangani".
  "chamari athapaththu": "AC Jayangani",
};

function matchPlayer(squadName: string, pool: DbPlayer[]): number | null {
  // Registry-FIRST: resolve the announced name to a stable cricsheet_id via the shared
  // global registry, then find that exact DB player. Deterministic (no fuzzy gamble) and
  // the same identity the points sheet & draft use. Falls back to the legacy alias+fuzzy
  // path for any player the registry doesn't cover yet.
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
    if (byCs) return byCs.id;
  }
  const resolvedName = NAME_ALIASES[normName(squadName)] ?? squadName;
  const match = fuzzyMatchName(resolvedName, pool.map((p) => p.name));
  return match !== null ? (pool.find((p) => p.name === match)?.id ?? null) : null;
}

export function buildWomensWCPool(
  sqlite: Database.Database,
  opts: { auctionId: number; tournamentId: number; teams?: WCTeam[] }
): BuildResult {
  const teams = opts.teams ?? WOMENS_T20_WC_2026;

  const insertPool = sqlite.prepare(
    `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?)`
  );

  const insertPlayer = sqlite.prepare(
    `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, ?, ?, 0, 'female')`
  );

  const getEfppm = sqlite.prepare(
    `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format = 'T20'
     ORDER BY bat_matches DESC
     LIMIT 1`
  );

  const result: BuildResult = {
    teams: 0,
    players: 0,
    matched: 0,
    created: 0,
    unmatched: [],
    teamBreakdown: [],
  };

  const transaction = sqlite.transaction(() => {
    for (const team of teams) {
      // Build a per-country pool of female players to match against.
      const rows = sqlite
        .prepare(
          `SELECT id, name, cricsheet_id FROM players WHERE gender = 'female' AND country = ?`
        )
        .all(team.country) as { id: number; name: string; cricsheet_id: string | null }[];

      const pool: DbPlayer[] = rows.map((r) => ({ id: r.id, name: r.name, cricsheetId: r.cricsheet_id }));

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
          // add to pool so duplicates within a squad don't re-create
          pool.push({ id: playerId, name: sp.name, cricsheetId: null });
        }

        const efppmRow = getEfppm.get(playerId) as
          | { avg_fantasy_points: number }
          | undefined;
        const efppm = efppmRow?.avg_fantasy_points || 0;

        insertPool.run(
          opts.tournamentId,
          playerId,
          0, // base price (valuation engine fills this on auction/start)
          opts.auctionId,
          team.short,
          squadNumber++,
          efppm
        );
      }

      result.teams++;
      result.teamBreakdown.push({
        team: team.short,
        name: team.name,
        playerCount: team.players.length,
      });
    }
  });

  transaction();
  return result;
}
