import { withTransaction, type DbHandle } from "@/db";
import {
  ENG_VS_PAK_TEST_2026,
  type TestTeam,
} from "./eng-vs-pak-test-2026";

// Builds the auction pool for the ENG v PAK Test series from the announced squads.
//
// DELIBERATELY DIFFERENT from every other builder here: resolution is by cricsheet identifier ONLY.
// There is no registry-name pass and no fuzzy fallback, and a name that does not resolve is a hard
// FAILURE rather than a statless newcomer.
//
// Why: a fuzzy pass is a hypothesis (CLAUDE.md), and this squad is the worst case for it — two
// distinct men are both called "Khurram Shahzad" and the one who is NOT in the squad has three
// times the appearances, so every "most matches wins" tie-break picks wrong. "Emilio Gay" reaches
// for CH Gayle's 548 appearances; "Awais Zafar" sits beside a woman of nearly the same name. Every
// csid in the squad file was verified against cricsheet's own per-match registry, scoped to the
// England and Pakistan Test XIs, so there is nothing left for a fuzzy pass to add — only wrong
// answers for it to introduce. Failing loud is the point: a silent mis-resolution here prices one
// player's career onto another's name and nobody notices until the points arrive.
//
// The one genuinely uncapped player (Ghazi Ghori — no TEST or FC record at all) still resolves,
// because he has white-ball data under a unique name. He prices at the floor, which is correct.

interface DbPlayer {
  id: number;
  name: string;
  cricsheetId: string | null;
}

interface BuildResult {
  teams: number;
  players: number;
  matched: number;
  unmatched: { team: string; name: string; csid: string }[];
  teamBreakdown: { team: string; name: string; playerCount: number }[];
}

export async function buildTestPool(
  sqlite: DbHandle,
  opts: { auctionId: number; tournamentId: number; teams?: TestTeam[] }
): Promise<BuildResult> {
  const teams = opts.teams ?? ENG_VS_PAK_TEST_2026;

  const wanted = new Set(teams.flatMap((t) => t.players.map((p) => p.csid)));
  const placeholders = [...wanted].map(() => "?").join(",");
  const rows = (await sqlite
    .prepare(
      `SELECT p.id, p.name, p.cricsheet_id AS cricsheetId
         FROM players p
        WHERE p.cricsheet_id IN (${placeholders})`
    )
    .all(...wanted)) as DbPlayer[];

  // Duplicate cricsheet_id rows break anchoring (the phantom-duplicate failure in CLAUDE.md), so
  // catch it here rather than letting one row win arbitrarily.
  const byCsid = new Map<string, DbPlayer>();
  for (const r of rows) {
    if (!r.cricsheetId) continue;
    if (byCsid.has(r.cricsheetId)) {
      throw new Error(
        `Duplicate players rows share cricsheet_id ${r.cricsheetId}: ` +
          `#${byCsid.get(r.cricsheetId)!.id} "${byCsid.get(r.cricsheetId)!.name}" and ` +
          `#${r.id} "${r.name}". Dedup in the registry before building the pool.`
      );
    }
    byCsid.set(r.cricsheetId, r);
  }

  const missing = teams.flatMap((t) =>
    t.players.filter((p) => !byCsid.has(p.csid)).map((p) => ({ team: t.short, name: p.name, csid: p.csid }))
  );
  if (missing.length) {
    throw new Error(
      `No players row for ${missing.length} squad member(s): ` +
        missing.map((m) => `${m.name} (${m.team}, csid ${m.csid})`).join("; ") +
        `. Run the red-ball ETL first (data/raw/tests + cch + ssh) — do NOT fall back to name matching.`
    );
  }

  const result: BuildResult = {
    teams: 0, players: 0, matched: 0, unmatched: [], teamBreakdown: [],
  };

  await withTransaction(async (tx) => {
    const insertPool = tx.prepare(
      `INSERT OR IGNORE INTO auction_pool
       (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note)
     VALUES (?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)`
    );
    // Keep role/country in step with the squad file — several of these players sit in the DB with
    // country="Unknown" (they arrived via cricsheet initials) and roles inferred from white-ball
    // data, which mislabels red-ball specialists.
    const updatePlayer = tx.prepare(
      `UPDATE players SET role = ?, country = ?, gender = COALESCE(gender, 'male') WHERE id = ?`
    );
    // Initial efppm hint only — the engine recomputes the real blended value on /api/auction/start.
    // Scoped to TEST so the hint is red-ball, never a white-ball average.
    const getEfppm = tx.prepare(
      `SELECT avg_fantasy_points FROM career_stats WHERE player_id = ? AND format = 'TEST' LIMIT 1`
    );

    for (const team of teams) {
      let squadNumber = 1;
      for (const sp of team.players) {
        result.players++;
        const player = byCsid.get(sp.csid)!;
        result.matched++;

        await updatePlayer.run(sp.role, team.country, player.id);
        const efppmRow = (await getEfppm.get(player.id)) as { avg_fantasy_points: number } | undefined;
        await insertPool.run(
          opts.tournamentId, player.id, 0, opts.auctionId,
          team.short, squadNumber++, efppmRow?.avg_fantasy_points || 0, sp.note ?? ""
        );
      }
      result.teams++;
      result.teamBreakdown.push({ team: team.short, name: team.name, playerCount: team.players.length });
    }
  });

  return result;
}
