import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

// Per-season fantasy-points leaderboard for the players in a tournament's pool (the squads).
// Two modes, resolved from the tournament:
//   • FRANCHISE league (IPL / The Hundred / MLC / LPL / WPL / BBL / …) → rank on that
//     league's OWN format, over its last 2 editions (the 2 most-recent seasons with data).
//   • INTERNATIONAL tour (bilateral series / World Cup) → rank on international T20 or ODI
//     form, over this year + last year (again, the 2 most-recent seasons with data).
// In both modes we only show players who are IN THE SQUADS (the auction pool) so the board
// is a pick aid. `fantasy_points` is the format-appropriate scorer already stored per innings.

interface RankConfig {
  kind: "franchise" | "international";
  format: string; // match_performances.format to rank on
  label: string;  // human label for the panel
}

// Franchise leagues we hold data for → their match_performances.format tag. Extensible: add a
// row here + ensure the ETL tags that league's cricsheet dumps with the same format string.
const FRANCHISE_LEAGUES: { test: RegExp; format: string; label: string }[] = [
  { test: /hundred/i, format: "HUN", label: "The Hundred" },
  { test: /\bmlc\b/i, format: "MLC", label: "MLC" },
  { test: /\blpl\b/i, format: "LPL", label: "LPL" },
  { test: /\bwpl\b/i, format: "WPL", label: "WPL" },
  { test: /\bbbl\b|big bash/i, format: "BBL", label: "BBL" },
  { test: /\bwbbl\b/i, format: "WBBL", label: "WBBL" },
  { test: /\bpsl\b/i, format: "PSL", label: "PSL" },
  { test: /\bcpl\b/i, format: "CPL", label: "CPL" },
  { test: /\bsa20\b/i, format: "SA20", label: "SA20" },
  { test: /il\s?t20/i, format: "ILT20", label: "ILT20" },
];

function resolveRankConfig(name: string, format: string, matchFormat: string): RankConfig {
  // IPL is stored under 'IPL' but the auction format is 'IPL'; its scrape name is "IPL …".
  if (format === "IPL" || /\bipl\b/i.test(name)) {
    return { kind: "franchise", format: "IPL", label: "IPL" };
  }
  for (const lg of FRANCHISE_LEAGUES) {
    if (lg.test.test(name)) return { kind: "franchise", format: lg.format, label: lg.label };
  }
  // Everything else (BILATERAL series, CUSTOM World Cups) is an international tour: rank on the
  // international format. The 'T20' bucket holds T20Is; 'ODI' holds ODIs.
  const intl = matchFormat === "ODI" ? "ODI" : "T20";
  return { kind: "international", format: intl, label: intl === "ODI" ? "ODI" : "T20I" };
}

interface SeasonStat { inns: number; total: number; avg: number }
interface Leader {
  id: number;
  name: string;
  role: string;
  isOverseas: boolean;
  team: string | null;
  total: number;
  inns: number;
  avg: number;
  seasons: Record<number, SeasonStat>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;

  const tour = await sqlite
    .prepare("SELECT * FROM tournaments WHERE id = ?")
    .get(tournamentId) as Record<string, unknown> | undefined;
  if (!tour) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  const config = resolveRankConfig(
    tour.name as string,
    tour.format as string,
    tour.match_format as string
  );

  // Squads = the players in this tournament's pool.
  const poolRows = await sqlite
    .prepare(
      `SELECT DISTINCT ap.player_id AS id, p.name, p.role, p.is_overseas AS isOverseas, ap.ipl_team AS team
       FROM auction_pool ap JOIN players p ON ap.player_id = p.id
       WHERE ap.tournament_id = ?`
    )
    .all(tournamentId) as Array<{ id: number; name: string; role: string; isOverseas: number; team: string | null }>;

  if (poolRows.length === 0) {
    return NextResponse.json({ config, seasons: [], leaders: [], poolSize: 0 });
  }

  const ids = poolRows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");

  // The 2 most-recent seasons (calendar years) with data for this format among squad players.
  const seasonRows = await sqlite
    .prepare(
      `SELECT DISTINCT CAST(strftime('%Y', match_date) AS INTEGER) AS yr
       FROM match_performances
       WHERE format = ? AND player_id IN (${ph})
       ORDER BY yr DESC LIMIT 2`
    )
    .all(config.format, ...ids) as Array<{ yr: number }>;
  const seasons = seasonRows.map((r) => r.yr); // e.g. [2025, 2024]

  if (seasons.length === 0) {
    return NextResponse.json({ config, seasons: [], leaders: [], poolSize: poolRows.length });
  }

  const yrPh = seasons.map(() => "?").join(",");
  const agg = await sqlite
    .prepare(
      `SELECT player_id AS id, CAST(strftime('%Y', match_date) AS INTEGER) AS yr,
              COUNT(*) AS inns, ROUND(SUM(fantasy_points)) AS total, ROUND(AVG(fantasy_points), 1) AS avg
       FROM match_performances
       WHERE format = ? AND player_id IN (${ph})
         AND CAST(strftime('%Y', match_date) AS INTEGER) IN (${yrPh})
       GROUP BY player_id, yr`
    )
    .all(config.format, ...ids, ...seasons) as Array<{ id: number; yr: number; inns: number; total: number; avg: number }>;

  const byId = new Map<number, Leader>();
  for (const r of poolRows) {
    byId.set(r.id, {
      id: r.id, name: r.name, role: r.role, isOverseas: !!r.isOverseas, team: r.team,
      total: 0, inns: 0, avg: 0, seasons: {},
    });
  }
  for (const a of agg) {
    const p = byId.get(a.id);
    if (!p) continue;
    p.seasons[a.yr] = { inns: a.inns, total: a.total ?? 0, avg: a.avg ?? 0 };
  }

  // Keep only players with data in at least one of the two seasons; compute 2-season totals.
  const leaders = [...byId.values()].filter((p) => Object.keys(p.seasons).length > 0);
  for (const p of leaders) {
    let t = 0, inns = 0;
    for (const y of seasons) {
      const s = p.seasons[y];
      if (s) { t += s.total; inns += s.inns; }
    }
    p.total = t;
    p.inns = inns;
    p.avg = inns ? Math.round((t / inns) * 10) / 10 : 0;
  }
  // Rank by the LATEST season's points (seasons[0] is the most recent) so a player with a
  // single strong season isn't buried under 2-season accumulators; tie-break on 2-season total.
  const latest = seasons[0];
  leaders.sort((a, b) => {
    const la = a.seasons[latest]?.total ?? 0;
    const lb = b.seasons[latest]?.total ?? 0;
    if (lb !== la) return lb - la;
    return b.total - a.total;
  });

  return NextResponse.json({ config, seasons, leaders, poolSize: poolRows.length });
}
