import { NextRequest, NextResponse } from "next/server";
import { client } from "@/db";
import { calculateFantasyPoints } from "@/lib/fantasy-points/calculator";
import type { MatchPerformance, PlayerRole } from "@/lib/fantasy-points/types";
import { getTourVenueContext } from "@/lib/venues/tour-venues";

/** One innings of a red-ball match, as persisted by the ETL in match_performances.innings_detail. */
interface InningsSplit {
  batRuns: number;
  batBalls: number;
  bat4s: number;
  bat6s: number;
  batDismissed: boolean;
  bowlWickets: number;
  bowlRuns: number;
  bowlBalls: number;
  catches: number;
}

// Null for every non-red-ball row. Malformed JSON degrades to null rather than failing the request —
// the split is a display nicety, the aggregate columns are still correct without it.
function parseInningsDetail(raw: unknown): InningsSplit[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr.map((x: Record<string, unknown>) => ({
      batRuns: Number(x.bat_runs ?? 0),
      batBalls: Number(x.bat_balls ?? 0),
      bat4s: Number(x.bat_4s ?? 0),
      bat6s: Number(x.bat_6s ?? 0),
      batDismissed: Boolean(x.bat_dismissed),
      bowlWickets: Number(x.bowl_wickets ?? 0),
      bowlRuns: Number(x.bowl_runs ?? 0),
      bowlBalls: Number(x.bowl_balls ?? 0),
      catches: Number(x.catches ?? 0),
    }));
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id);

  if (isNaN(playerId)) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  // Venue stats. When a tour is supplied AND we have a venue model for it (The Hundred / LPL
  // today), restrict to just the grounds used in that tour. The pre-aggregated player_venue_stats
  // table is keyed per cricsheet name-variant (one physical ground -> several rows, e.g.
  // "Headingley" + "Headingley, Leeds"), so we can't just filter it — we'd list each ground twice.
  // Instead re-aggregate straight from match_performances, merging each venue's name variants into
  // one canonical row (same variants + formulas /api/venues and the ETL use, so numbers agree).
  // Otherwise fall back to the player's career top-10 venues (used by /compare and by tours with
  // no venue model).
  const tour = req.nextUrl.searchParams.get("tour") ?? "";

  // PERF: every player-scoped read below is independent of the others, so they all go out as ONE
  // `client.batch(..., "read")` instead of 7 sequential network round-trips. The tour venue context
  // (its own query) runs concurrently with that batch. Results come back in the order queued.
  // Only the no-tour venue fallback is conditional, so it is appended last.
  const mainStmts: Array<{ sql: string; args: Array<number> }> = [
    // Player basic info
    { sql: "SELECT * FROM players WHERE id = ?", args: [playerId] },
    // Career stats (all formats)
    { sql: "SELECT * FROM career_stats WHERE player_id = ? ORDER BY format", args: [playerId] },
    // Recent match performances.
    //
    // A flat "last 40 by date" is wrong for red ball. These players are white-ball regulars — a
    // Blast/Hundred season alone is 20+ games — so the 40 most recent matches can cover barely six
    // months and leave a Test specialist with three or four Tests visible. A Test is also played
    // roughly monthly at best, so judging red-ball form needs YEARS of it, not a match count.
    //
    // So: the last 40 of anything (white-ball behaviour unchanged) UNION the last 25 TESTS UNION the
    // last 20 first-class.
    //
    // TEST and FC get SEPARATE budgets rather than a shared red-ball one. Sharing 30 slots between
    // them fails for exactly the players who need it most: Dan Lawrence is out of the Test side, so
    // his recent red-ball matches are all County Championship, and a shared budget left him 3 Tests
    // and 27 county games. 25 Tests reaches back 3+ years for everyone in this squad, and past a
    // full career for the fringe players.
    {
      sql: `
      SELECT * FROM match_performances
      WHERE player_id = ? AND id IN (
        SELECT id FROM (
          SELECT id FROM match_performances WHERE player_id = ?
          ORDER BY match_date DESC LIMIT 40
        )
        UNION
        SELECT id FROM (
          SELECT id FROM match_performances WHERE player_id = ? AND format = 'TEST'
          ORDER BY match_date DESC LIMIT 25
        )
        UNION
        -- A match COUNT cannot guarantee a time span, and for red ball the span is the point. Root
        -- plays so much Test cricket that his last 25 Tests cover only 1.9 years, while Lawrence's
        -- 14 cover 3.6. So take EVERY Test in the last 3 years as well, and let whichever rule is
        -- more generous win.
        SELECT id FROM match_performances
        WHERE player_id = ? AND format = 'TEST'
          AND match_date >= date('now', '-36 months')
        UNION
        SELECT id FROM (
          SELECT id FROM match_performances WHERE player_id = ? AND format = 'FC'
          ORDER BY match_date DESC LIMIT 20
        )
      )
      ORDER BY match_date DESC
    `,
      args: [playerId, playerId, playerId, playerId, playerId],
    },
    // Opposition stats (top 10 by matches)
    {
      sql: `
      SELECT * FROM player_opposition_stats
      WHERE player_id = ?
      ORDER BY matches DESC
      LIMIT 10
    `,
      args: [playerId],
    },
    // Fantasy points trend (last 20 matches)
    {
      sql: `
      SELECT match_date, fantasy_points, format, opposition, venue_name,
             bat_runs, bat_balls, bat_4s, bat_6s,
             bowl_wickets, bowl_balls, bowl_runs, bowl_dots,
             catches, stumpings, run_outs
      FROM match_performances
      WHERE player_id = ?
      ORDER BY match_date DESC
      LIMIT 20
    `,
      args: [playerId],
    },
    // Match performances the fantasy breakdown is computed from (IPL/T20 matches)
    {
      sql: `
      SELECT format, bat_runs, bat_balls, bat_4s, bat_6s, bat_dismissed, dismissal_type,
             bowl_balls, bowl_runs, bowl_wickets, bowl_maidens, bowl_dots, bowl_lbw_bowled,
             catches, stumpings, run_outs, direct_run_outs, fantasy_points
      FROM match_performances
      WHERE player_id = ? AND format IN ('IPL', 'T20I', 'T20', 'ODI')
      ORDER BY match_date DESC
      LIMIT 50
    `,
      args: [playerId],
    },
    // Avg batting position across white-ball franchise/T20 (excludes did-not-bat: bat_position null).
    {
      sql: `SELECT ROUND(AVG(bat_position), 1) AS avg_pos, COUNT(*) AS inns
       FROM match_performances
       WHERE player_id = ? AND bat_position IS NOT NULL
         AND format IN ('HUN','WPL','T20','WBBL','BLAST')`,
      args: [playerId],
    },
  ];
  // The career top-10 venue fallback is ALWAYS fetched, even when a tour is supplied.
  //
  // It used to be gated on `if (!tour)`, which conflated "a tour was named" with "that tour has a
  // venue model". Only the Hundred, LPL and CPL have one, so for every other tour —
  // ENG v PAK Test, IND v ENG T20I, both ODI bilaterals — getTourVenueContext() returns null, the
  // code fell to the `else` branch below, and read mainRows[7] which had never been queued. Reading
  // `.rows` of undefined threw, so the endpoint 500'd and the player modal hung on
  // "Loading player details..." forever. One extra LIMIT 10 read on an indexed table is a much better
  // trade than a whole tour class having no working player modal.
  const FALLBACK_VENUE_IDX = mainStmts.length;
  mainStmts.push({
    sql: `
        SELECT pvs.*, v.name as venue_name, v.city, v.country, v.pitch_type
        FROM player_venue_stats pvs
        JOIN venues v ON pvs.venue_id = v.id
        WHERE pvs.player_id = ?
        ORDER BY pvs.matches DESC
        LIMIT 10
      `,
    args: [playerId],
  });

  const [mainRows, tourVenues] = await Promise.all([
    client.batch(mainStmts, "read"),
    tour ? getTourVenueContext(tour) : Promise.resolve(null),
  ]);

  const player = mainRows[0].rows[0] as unknown as Record<string, unknown> | undefined;

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const careerStats = mainRows[1].rows as unknown as Record<string, unknown>[];
  const recentMatches = mainRows[2].rows as unknown as Record<string, unknown>[];
  const oppositionStats = mainRows[3].rows as unknown as Record<string, unknown>[];
  const fantasyTrend = mainRows[4].rows as unknown as Record<string, unknown>[];
  const breakdownMatches = mainRows[5].rows as unknown as Record<string, unknown>[];
  const batPosRow = mainRows[6].rows[0] as unknown as { avg_pos: number | null; inns: number };

  let venueStats: Record<string, unknown>[];
  if (tourVenues) {
    // PERF: the two per-ground queries used to be awaited in sequence inside a Promise.all fan-out,
    // i.e. 2 round-trips deep per ground. They're all independent, so the whole 2 x nVenues set is
    // sent as ONE batch; ground i owns indices [2i, 2i+1]. Same SQL, same params, same order — the
    // filter/sort below is unchanged, so the row set is identical.
    const venueStmts: Array<{ sql: string; args: Array<string | number> }> = [];
    for (const v of tourVenues.venues) {
      const vp = v.variants.map(() => "?").join(",");
      // Per-ground aggregation mirrors compute_venue_stats() in data/etl_cricsheet.py.
      venueStmts.push({
        sql: `
              SELECT
                COUNT(*) AS matches,
                SUM(COALESCE(bat_runs, 0)) AS bat_runs,
                CASE WHEN SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END) > 0
                     THEN CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END)
                     ELSE 0 END AS bat_avg,
                CASE WHEN SUM(COALESCE(bat_balls, 0)) > 0
                     THEN CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(COALESCE(bat_balls, 0)) * 100
                     ELSE 0 END AS bat_sr,
                SUM(COALESCE(bowl_wickets, 0)) AS bowl_wickets,
                CASE WHEN SUM(COALESCE(bowl_balls, 0)) > 0
                     THEN CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / (SUM(COALESCE(bowl_balls, 0)) / 6.0)
                     ELSE 0 END AS bowl_econ,
                AVG(COALESCE(fantasy_points, 0)) AS avg_fantasy_points
              FROM match_performances
              WHERE player_id = ? AND venue_name IN (${vp})
            `,
        args: [playerId, ...v.variants],
      });
      // city + pitch_type come from the venues catalog. Seed data populates these on only some
      // name variants, so MAX() (which skips NULLs in SQLite) prefers a populated value.
      venueStmts.push({
        sql: `SELECT MAX(city) AS city, MAX(pitch_type) AS pitch_type FROM venues WHERE name IN (${vp})`,
        args: [...v.variants],
      });
    }
    const venueRows = await client.batch(venueStmts, "read");
    venueStats = tourVenues.venues
      .map((v, i): Record<string, unknown> => {
        const agg = venueRows[i * 2].rows[0] as unknown as Record<string, unknown>;
        const meta =
          (venueRows[i * 2 + 1].rows[0] as unknown as Record<string, unknown> | undefined) ?? {};
        return { venue_name: v.canonical, ...meta, ...agg };
      })
      .filter((r) => (r.matches as number) > 0)
      .sort((a, b) => (b.matches as number) - (a.matches as number));
  } else {
    // No venue model for this tour (or no tour at all) — fall back to the player's career grounds.
    venueStats = (mainRows[FALLBACK_VENUE_IDX]?.rows ??
      []) as unknown as Record<string, unknown>[];
  }

  let fantasyBreakdown = null;
  if (breakdownMatches.length > 0) {
    const role = (player.role as PlayerRole) || "BAT";
    let sumBatting = 0, sumBowling = 0, sumFielding = 0, sumSr = 0, sumEcon = 0, sumXi = 0;
    const totals: number[] = [];

    for (const m of breakdownMatches) {
      const perf: MatchPerformance = {
        batRuns: (m.bat_runs as number) || 0,
        batBalls: (m.bat_balls as number) || 0,
        bat4s: (m.bat_4s as number) || 0,
        bat6s: (m.bat_6s as number) || 0,
        batDismissed: !!(m.bat_dismissed),
        dismissalType: (m.dismissal_type as string) || undefined,
        bowlBalls: (m.bowl_balls as number) || 0,
        bowlRuns: (m.bowl_runs as number) || 0,
        bowlWickets: (m.bowl_wickets as number) || 0,
        bowlMaidens: (m.bowl_maidens as number) || 0,
        bowlDots: (m.bowl_dots as number) || 0,
        bowlLbwBowled: (m.bowl_lbw_bowled as number) || 0,
        catches: (m.catches as number) || 0,
        stumpings: (m.stumpings as number) || 0,
        runOuts: (m.run_outs as number) || 0,
        directRunOuts: (m.direct_run_outs as number) || 0,
      };
      const bd = calculateFantasyPoints(perf, role, m.format as string);
      sumBatting += bd.batting;
      sumBowling += bd.bowling;
      sumFielding += bd.fielding;
      sumSr += bd.strikeRate;
      sumEcon += bd.economyRate;
      sumXi += bd.startingXi;
      totals.push(bd.total);
    }

    const n = breakdownMatches.length;
    const avgTotal = totals.reduce((a, b) => a + b, 0) / n;
    const variance = totals.reduce((sum, t) => sum + Math.pow(t - avgTotal, 2), 0) / n;

    fantasyBreakdown = {
      avgBatting: sumBatting / n,
      avgBowling: sumBowling / n,
      avgFielding: sumFielding / n,
      avgSrBonus: sumSr / n,
      avgEconBonus: sumEcon / n,
      avgStartingXi: sumXi / n,
      avgTotal,
      matchCount: n,
      bestMatch: Math.max(...totals),
      worstMatch: Math.min(...totals),
      consistency: Math.sqrt(variance),
    };
  }

  // (avg batting position — `batPosRow` — came back in the batch above)
  return NextResponse.json({
    avgBatPosition: batPosRow.avg_pos,
    batPositionInns: batPosRow.inns,
    player: {
      id: player.id,
      name: player.name,
      fullName: player.full_name,
      country: player.country,
      role: player.role,
      batStyle: player.bat_style,
      bowlStyle: player.bowl_style,
      isOverseas: player.is_overseas,
      dob: player.dob,
    },
    fantasyBreakdown,
    careerStats: careerStats.map((cs) => ({
      format: cs.format,
      matches: cs.bat_matches,
      innings: cs.bat_innings,
      runs: cs.bat_runs,
      batAvg: cs.bat_avg,
      batSr: cs.bat_sr,
      fifties: cs.bat_50s,
      hundreds: cs.bat_100s,
      hs: cs.bat_hs,
      fours: cs.bat_4s,
      sixes: cs.bat_6s,
      bowlInnings: cs.bowl_innings,
      wickets: cs.bowl_wickets,
      bowlAvg: cs.bowl_avg,
      bowlEcon: cs.bowl_econ,
      bowlSr: cs.bowl_sr,
      catches: cs.catches,
      stumpings: cs.stumpings,
      efppm: cs.avg_fantasy_points,
      totalPoints: cs.total_fantasy_points,
    })),
    recentMatches: recentMatches.map((m) => ({
      matchId: m.match_id,
      date: m.match_date,
      format: m.format,
      batPos: m.bat_position,
      opposition: m.opposition,
      venue: m.venue_name,
      batRuns: m.bat_runs,
      batBalls: m.bat_balls,
      bat4s: m.bat_4s,
      bat6s: m.bat_6s,
      bowlWickets: m.bowl_wickets,
      bowlRuns: m.bowl_runs,
      bowlBalls: m.bowl_balls,
      catches: m.catches,
      fantasyPoints: m.fantasy_points,
      // Red-ball only: the per-innings split, so the UI can show "1 & 60" rather than a match
      // aggregate of "61". Every other column here is a MATCH total while fantasyPoints is scored
      // per innings and summed, so without this the row cannot be reconciled with its own FP.
      innings: parseInningsDetail(m.innings_detail),
    })),
    venueStats: venueStats.map((vs) => ({
      venueId: vs.venue_id,
      venueName: vs.venue_name,
      city: vs.city,
      pitchType: vs.pitch_type,
      matches: vs.matches,
      batRuns: vs.bat_runs,
      batAvg: vs.bat_avg,
      batSr: vs.bat_sr,
      bowlWickets: vs.bowl_wickets,
      bowlEcon: vs.bowl_econ,
      efppm: vs.avg_fantasy_points,
    })),
    oppositionStats: oppositionStats.map((os) => ({
      opposition: os.opposition,
      format: os.format,
      matches: os.matches,
      batRuns: os.bat_runs,
      batAvg: os.bat_avg,
      batSr: os.bat_sr,
      bowlWickets: os.bowl_wickets,
      bowlEcon: os.bowl_econ,
      efppm: os.avg_fantasy_points,
    })),
    fantasyTrend: fantasyTrend.map((ft) => ({
      date: ft.match_date,
      points: ft.fantasy_points,
      format: ft.format,
      opposition: ft.opposition,
      venue: ft.venue_name,
    })),
  });
}
