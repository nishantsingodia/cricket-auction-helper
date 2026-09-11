import { withTransaction, type DbHandle } from "@/db";
import {
  IND_VS_ENG_T20_2026,
  IND_ENG_NAME_ALIASES,
  type BilateralTeam,
} from "./ind-vs-eng-t20-2026";
import { fuzzyMatchName, normName } from "@/lib/fuzzy-name-match";
import { resolveByName } from "@/lib/registry";

// Builds the auction pool for a bilateral T20I series (India vs England 2026) from the
// announced squads. Like MLC (and UNLIKE the women's WC) we do NOT scope matching by
// country — several capped England players sit in the DB under cricsheet initials with
// country="Unknown" (HC Brook, AU Rashid). Instead, match each squad player against ALL
// men's players who have IPL/T20I match data, in three passes:
//   1. registry cricsheet_id (the shared global identity — deterministic)
//   2. exact alias spelling (IND_ENG_NAME_ALIASES — for espn:/slug: registry pids)
//   3. fuzzy name (surname + initial etc.)
// Unmatched (genuinely uncapped newcomers — Coles, Tongue, Baker, Shedge, Prince) are
// created statless and price near baseline.

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

function matchPlayer(
  squadName: string,
  pool: DbPlayer[],
  opts: { aliases: Record<string, string>; csidBridge?: Record<string, string>; noFuzzy?: boolean }
): number | null {
  // 0. Explicit cricsheet_id bridge, keyed on the EXACT announced name. Takes precedence over
  //    everything, including the registry: it is a hand-verified identity for a squad the
  //    registry does not cover yet. Used by the twin-bilateral tour, where name matching is
  //    actively dangerous (three "Rashid Khan" rows, etc. — see ENG_SL_IND_AFG_CSID).
  const bridged = opts.csidBridge?.[squadName];
  if (bridged) {
    const byBridge = pool.find((p) => p.cricsheetId === bridged);
    if (byBridge) return byBridge.id;
    // A bridge that resolves to nothing is a DATA error, not a reason to go guessing by name.
    return null;
  }
  // 1. Registry-FIRST: deterministic cricsheet_id identity (same identity the points
  //    sheet & draft use), before any fuzzy logic.
  const hit = resolveByName(squadName);
  if (hit?.cricsheetId) {
    const byCs = pool.find((p) => p.cricsheetId === hit.cricsheetId);
    if (byCs) return byCs.id;
  }
  // 2. Exact alias spelling — an alias is the EXACT DB spelling, matched exactly before
  //    any fuzzy logic (so the surname-only fallback can't grab a same-surname player).
  const alias = opts.aliases[normName(squadName)];
  if (alias) {
    const target = normName(alias);
    const exact = pool.find((p) => normName(p.name) === target);
    if (exact) return exact.id;
  }
  // 3. Fuzzy fallback — suppressed for squads where a surname match is a known hazard.
  if (opts.noFuzzy) return null;
  const resolved = alias ?? squadName;
  const match = fuzzyMatchName(resolved, pool.map((p) => p.name));
  return match !== null ? pool.find((p) => p.name === match)?.id ?? null : null;
}

export async function buildBilateralT20Pool(
  sqlite: DbHandle,
  opts: {
    auctionId: number;
    tournamentId: number;
    teams?: BilateralTeam[];
    /** normName-keyed announced -> exact DB spelling. Defaults to the IND v ENG map. */
    aliases?: Record<string, string>;
    /** Exact announced name -> cricsheet_id. Hand-verified; beats registry and alias. */
    csidBridge?: Record<string, string>;
    /**
     * Formats the CANDIDATE pool is drawn from. Defaults to IPL + T20I, which is right for a
     * two-top-8-nation series. A squad whose record lives in other franchise leagues (Afghanistan,
     * whose T20Is cricsheet withholds) MUST widen this, or those players are absent from the
     * candidate set and get re-created as statless duplicates despite being in the DB.
     */
    matchFormats?: string[];
    /** Disable the surname fuzzy fallback for squads where it steals a namesake. */
    noFuzzy?: boolean;
  }
): Promise<BuildResult> {
  const teams = opts.teams ?? IND_VS_ENG_T20_2026;
  const aliases = opts.aliases ?? IND_ENG_NAME_ALIASES;
  const matchFormats = opts.matchFormats ?? ["IPL", "T20"];

  // Matching pool: every men's player with MATCH data in the relevant formats (not career_stats —
  // so a data-rich player is never missed even if their career_stats row is absent).
  const fmtPlaceholders = matchFormats.map(() => "?").join(",");
  const pool = await sqlite
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.cricsheet_id AS cricsheetId FROM players p
       JOIN match_performances mp ON mp.player_id = p.id AND mp.format IN (${fmtPlaceholders})
       WHERE p.gender != 'female' OR p.gender IS NULL`
    )
    .all(...matchFormats) as DbPlayer[];

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, created: 0, unmatched: [], teamBreakdown: [],
  };

  await withTransaction(async (tx) => {
    const insertPool = tx.prepare(
      `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)`
    );
    const insertPlayer = tx.prepare(
      `INSERT INTO players (name, country, role, is_overseas, gender)
     VALUES (?, ?, ?, 0, 'male')`
    );
    // Before creating a statless newcomer, reuse the one an EARLIER build already created for the
    // same name. Deliberately narrow: it only ever matches a row with no match data at all, so it
    // can reuse our own prior insert but can never latch onto a real player who happens to share a
    // spelling. Two things go wrong without it:
    //   - re-fetching a pool (or rebuilding one) silently duplicates every unmatched player in
    //     `players`, which is REFERENCE data — measured: 4 dupes per rebuild on this tour.
    //   - `players` is local-master but the pool is built cloud-side, so a cloud-created statless
    //     row is invisible to the laptop and the next turso:sync replaces `players` without it,
    //     leaving cloud auction_pool rows pointing at nothing. (The sync's orphan guard catches
    //     that and aborts, which is safe but means a blocked sync instead of a working board.)
    const findStatless = tx.prepare(
      `SELECT id FROM players
        WHERE name = ? AND (gender != 'female' OR gender IS NULL)
          AND NOT EXISTS (SELECT 1 FROM match_performances m WHERE m.player_id = players.id)
        ORDER BY id LIMIT 1`
    );
    // Initial efppm hint (engine recomputes the real blended value on auction/start).
    // Scoped to the same formats as the candidate pool, so an Afghan player whose record is all
    // ILT20/SA20 gets a real hint instead of 0 (and a momentary ₹0 on the board before the
    // valuation pass that /api/pool/fetch runs at the end of this call).
    const getEfppm = tx.prepare(
      `SELECT avg_fantasy_points FROM career_stats
     WHERE player_id = ? AND format IN (${fmtPlaceholders})
     ORDER BY CASE format WHEN 'T20' THEN 1 WHEN 'IPL' THEN 2 ELSE 3 END
     LIMIT 1`
    );

    for (const team of teams) {
      let squadNumber = 1;
      for (const sp of team.players) {
        result.players++;
        let playerId = matchPlayer(sp.name, pool, {
          aliases,
          csidBridge: opts.csidBridge,
          noFuzzy: opts.noFuzzy,
        });
        if (playerId) {
          result.matched++;
        } else {
          const existing = (await findStatless.get(sp.name)) as { id: number } | undefined;
          if (existing) {
            playerId = existing.id;
          } else {
            const ins = await insertPlayer.run(sp.name, team.country, sp.role);
            playerId = Number(ins.lastInsertRowid);
          }
          result.created++;
          result.unmatched.push({ team: team.short, name: sp.name });
          pool.push({ id: playerId, name: sp.name, cricsheetId: null }); // avoid re-creating dupes
        }

        const efppmRow = (await getEfppm.get(playerId, ...matchFormats)) as
          | { avg_fantasy_points: number }
          | undefined;
        const sn = squadNumber++;
        await insertPool.run(
          opts.tournamentId, playerId, 0, opts.auctionId,
          team.short, sn, efppmRow?.avg_fantasy_points || 0, sp.note ?? ""
        );
      }
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  return result;
}
