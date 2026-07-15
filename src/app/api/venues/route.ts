import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import {
  getTourVenueContext,
  VENUE_PROFILES,
  VENUE_TYPE_LABEL,
  type VenueType,
} from "@/lib/venues/tour-venues";
import { BOWLER_STYLE, classifyBowlStyle } from "@/lib/venues/bowler-styles";

// GET /api/venues?tour=<tournament_name>
// Returns per-ground behavior for a tour's venues: the authoritative bat/bowl class (same one
// EFPPM uses), data-derived stats from match_performances (bat/bowl FP, boundaries, wickets,
// economy) + the venues-table innings scores, a CURATED spin/pace/seam profile, and recent
// matches at the ground. Read-only; safe on any auction.
export async function GET(request: NextRequest) {
  try {
    const tour = request.nextUrl.searchParams.get("tour") ?? "";
    const ctx = getTourVenueContext(tour);
    if (!ctx) {
      return NextResponse.json({ error: "No venue model for this tour" }, { status: 404 });
    }

    // teamShort(s) whose home is this ground (Hundred). Empty for neutral festivals (LPL).
    const homeTeamsOf: Record<string, string[]> = {};
    for (const [team, home] of Object.entries(ctx.homeOf)) {
      if (home) (homeTeamsOf[home] ||= []).push(team);
    }

    const fmtPlaceholders = ctx.venueFormats.map(() => "?").join(",");
    // Classification basis mirrors the engine's classifyVenues() window (men's/women's split by
    // gender, T20-family history since 2020) so the numbers line up with what valuation sees.
    const SINCE = "2020-01-01";

    const venues = ctx.venues.map((v) => {
      const vp = v.variants.map(() => "?").join(",");

      // 1) Character + aggregate behavior from ball-by-ball derived performances.
      const agg = sqlite
        .prepare(
          `SELECT
             AVG(CASE WHEN p.role IN ('BAT','WK') THEN mp.fantasy_points END) AS bat_fp,
             AVG(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points END) AS bowl_fp,
             COUNT(DISTINCT mp.match_id) AS matches,
             MIN(mp.match_date) AS from_date,
             MAX(mp.match_date) AS to_date,
             SUM(COALESCE(mp.bat_4s,0)) AS fours,
             SUM(COALESCE(mp.bat_6s,0)) AS sixes,
             SUM(COALESCE(mp.bowl_wickets,0)) AS wkts,
             SUM(COALESCE(mp.bowl_runs,0)) AS bruns,
             SUM(COALESCE(mp.bowl_balls,0)) AS bballs
           FROM match_performances mp
           JOIN players p ON mp.player_id = p.id
           WHERE mp.venue_name IN (${vp})
             AND mp.format IN (${fmtPlaceholders})
             AND p.gender = ?
             AND mp.match_date >= ?`
        )
        .get(...v.variants, ...ctx.venueFormats, ctx.gender, SINCE) as {
        bat_fp: number | null;
        bowl_fp: number | null;
        matches: number;
        from_date: string | null;
        to_date: string | null;
        fours: number;
        sixes: number;
        wkts: number;
        bruns: number;
        bballs: number;
      };

      // 2) Avg 1st-innings score from the seeded venues table (variants merged by mean). NOTE: the
      // venues table's avg_run_rate column is actually AVG(fantasy_points) (misnamed in seed_venues.py)
      // and avg_second_innings_score is only hand-seeded for a few grounds — so we deliberately DON'T
      // surface either; the real scoring rate comes from the computed bowling economy below.
      const inns = sqlite
        .prepare(`SELECT AVG(avg_first_innings_score) AS fis FROM venues WHERE name IN (${vp})`)
        .get(...v.variants) as { fis: number | null };

      // 3) Recent matches at the ground (aggregated per match) + its top fantasy performer.
      const recentRows = sqlite
        .prepare(
          `SELECT mp.match_id AS match_id,
                  MAX(mp.match_date) AS date,
                  MAX(mp.format) AS format,
                  SUM(COALESCE(mp.bat_runs,0)) AS runs,
                  SUM(COALESCE(mp.bat_6s,0)) AS sixes,
                  SUM(COALESCE(mp.bowl_wickets,0)) AS wkts
           FROM match_performances mp
           JOIN players p ON mp.player_id = p.id
           WHERE mp.venue_name IN (${vp})
             AND mp.format IN (${fmtPlaceholders})
             AND p.gender = ?
           GROUP BY mp.match_id
           ORDER BY date DESC
           LIMIT 6`
        )
        .all(...v.variants, ...ctx.venueFormats, ctx.gender) as Array<{
        match_id: string;
        date: string;
        format: string;
        runs: number;
        sixes: number;
        wkts: number;
      }>;

      let topByMatch: Record<string, { name: string; fp: number }> = {};
      if (recentRows.length) {
        const idPlaceholders = recentRows.map(() => "?").join(",");
        const tops = sqlite
          .prepare(
            `SELECT match_id, name, fantasy_points FROM (
               SELECT mp.match_id AS match_id, p.name AS name, mp.fantasy_points AS fantasy_points,
                 ROW_NUMBER() OVER (PARTITION BY mp.match_id ORDER BY mp.fantasy_points DESC) AS rn
               FROM match_performances mp
               JOIN players p ON mp.player_id = p.id
               WHERE mp.match_id IN (${idPlaceholders})
             ) WHERE rn = 1`
          )
          .all(...recentRows.map((r) => r.match_id)) as Array<{
          match_id: string;
          name: string;
          fantasy_points: number;
        }>;
        topByMatch = Object.fromEntries(tops.map((t) => [t.match_id, { name: t.name, fp: t.fantasy_points }]));
      }

      // 4) Spin vs pace effectiveness — sum wickets/runs/balls per bowler, classify via the
      // cricsheet_id-keyed style map, then derive average (runs/wkt), strike rate (balls/wkt) and
      // economy (runs/over) per type. Coverage = share of wickets where the bowler's style is known
      // (reported so a partial map stays honest). bowl_wickets excludes run-outs (bowler credits only).
      const wktRows = sqlite
        .prepare(
          `SELECT p.cricsheet_id AS cid,
                  p.bowl_style AS bowl_style,
                  SUM(mp.bowl_wickets) AS w,
                  SUM(COALESCE(mp.bowl_runs,0)) AS r,
                  SUM(COALESCE(mp.bowl_balls,0)) AS b
           FROM match_performances mp
           JOIN players p ON mp.player_id = p.id
           WHERE mp.venue_name IN (${vp})
             AND mp.format IN (${fmtPlaceholders})
             AND p.gender = ?
             AND mp.match_date >= ?
             AND mp.bowl_balls > 0
           GROUP BY p.id`
        )
        .all(...v.variants, ...ctx.venueFormats, ctx.gender, SINCE) as Array<{
        cid: string | null;
        bowl_style: string | null;
        w: number;
        r: number;
        b: number;
      }>;
      let spinWkts = 0, paceWkts = 0, totalWkts = 0;
      let spinRuns = 0, spinBalls = 0, paceRuns = 0, paceBalls = 0;
      for (const row of wktRows) {
        totalWkts += row.w;
        // PRIMARY: players.bowl_style (Wikipedia-backfilled); FALLBACK: hand-map by cricsheet_id.
        const style = classifyBowlStyle(row.bowl_style) ?? (row.cid ? BOWLER_STYLE[row.cid] : undefined);
        if (style === "spin") { spinWkts += row.w; spinRuns += row.r; spinBalls += row.b; }
        else if (style === "pace") { paceWkts += row.w; paceRuns += row.r; paceBalls += row.b; }
      }
      const classifiedWkts = spinWkts + paceWkts;
      // per-type rate stats (null when no wickets / no balls in that bucket)
      const rate = (runs: number, balls: number, wkts: number) => ({
        avg: wkts ? Math.round((runs / wkts) * 10) / 10 : null, // runs per wicket
        sr: wkts ? Math.round((balls / wkts) * 10) / 10 : null, // balls per wicket
        econ: balls ? Math.round((runs / balls) * 6 * 100) / 100 : null, // runs per over
      });

      const batFp = agg.bat_fp ?? null;
      const bowlFp = agg.bowl_fp ?? null;
      const ratio = batFp && bowlFp ? batFp / bowlFp : null;
      const matches = agg.matches ?? 0;

      return {
        canonical: v.canonical,
        type: v.type as VenueType,
        typeLabel: VENUE_TYPE_LABEL[v.type as VenueType],
        homeTeams: homeTeamsOf[v.canonical] ?? [],
        // data-derived
        matches,
        fromDate: agg.from_date,
        toDate: agg.to_date,
        batFp: batFp != null ? Math.round(batFp * 10) / 10 : null,
        bowlFp: bowlFp != null ? Math.round(bowlFp * 10) / 10 : null,
        ratio: ratio != null ? Math.round(ratio * 100) / 100 : null,
        boundariesPerMatch: matches ? Math.round(((agg.fours + agg.sixes) / matches) * 10) / 10 : null,
        sixesPerMatch: matches ? Math.round((agg.sixes / matches) * 10) / 10 : null,
        wktsPerMatch: matches ? Math.round((agg.wkts / matches) * 10) / 10 : null,
        econ: agg.bballs ? Math.round(((agg.bruns / agg.bballs) * 6) * 100) / 100 : null,
        avgFirstInnings: inns.fis != null ? Math.round(inns.fis) : null,
        // wickets by bowler type (data-derived from bowl_wickets + style map)
        wickets: {
          spin: spinWkts,
          pace: paceWkts,
          total: totalWkts,
          spinPct: classifiedWkts ? Math.round((spinWkts / classifiedWkts) * 100) : null,
          pacePct: classifiedWkts ? Math.round((paceWkts / classifiedWkts) * 100) : null,
          coverage: totalWkts ? Math.round((classifiedWkts / totalWkts) * 100) : 0,
          // effectiveness per type: avg = runs/wkt, sr = balls/wkt, econ = runs/over
          spinRates: rate(spinRuns, spinBalls, spinWkts),
          paceRates: rate(paceRuns, paceBalls, paceWkts),
        },
        // curated (clearly labeled non-computed in the UI)
        profile: VENUE_PROFILES[v.canonical] ?? null,
        recent: recentRows.map((r) => ({
          matchId: r.match_id,
          date: r.date,
          format: r.format,
          runs: r.runs,
          sixes: r.sixes,
          wkts: r.wkts,
          top: topByMatch[r.match_id] ?? null,
        })),
      };
    });

    // Tour-level bat vs bowl consensus — across ALL the tour's grounds, does history reward batting
    // or bowling, and by how much? Same batter-FP vs bowler-FP read the per-venue class uses, pooled.
    const allVariants = ctx.venues.flatMap((v) => v.variants);
    const avp = allVariants.map(() => "?").join(",");
    const tourAgg = sqlite
      .prepare(
        `SELECT
           AVG(CASE WHEN p.role IN ('BAT','WK') THEN mp.fantasy_points END) AS bat_fp,
           AVG(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points END) AS bowl_fp,
           COUNT(DISTINCT mp.match_id) AS matches
         FROM match_performances mp
         JOIN players p ON mp.player_id = p.id
         WHERE mp.venue_name IN (${avp})
           AND mp.format IN (${fmtPlaceholders})
           AND p.gender = ?
           AND mp.match_date >= ?`
      )
      .get(...allVariants, ...ctx.venueFormats, ctx.gender, SINCE) as {
      bat_fp: number | null;
      bowl_fp: number | null;
      matches: number;
    };
    const tBat = tourAgg.bat_fp;
    const tBowl = tourAgg.bowl_fp;
    let consensus: {
      lean: "batting" | "bowling" | "balanced";
      marginPct: number;
      batFp: number | null;
      bowlFp: number | null;
      matches: number;
    } = { lean: "balanced", marginPct: 0, batFp: null, bowlFp: null, matches: tourAgg.matches };
    if (tBat && tBowl) {
      const higher = Math.max(tBat, tBowl);
      const lower = Math.min(tBat, tBowl);
      const marginPct = Math.round((higher / lower - 1) * 100);
      const lean = marginPct < 3 ? "balanced" : tBowl > tBat ? "bowling" : "batting";
      consensus = {
        lean,
        marginPct,
        batFp: Math.round(tBat * 10) / 10,
        bowlFp: Math.round(tBowl * 10) / 10,
        matches: tourAgg.matches,
      };
    }

    return NextResponse.json({
      tour: ctx.tour,
      neutral: ctx.neutral,
      gender: ctx.gender,
      venueFormats: ctx.venueFormats,
      consensus,
      venues,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
