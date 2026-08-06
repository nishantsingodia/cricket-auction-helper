import { NextRequest, NextResponse } from "next/server";
import { client, sqlite } from "@/db";
import {
  getTourVenueContext,
  VENUE_PROFILES,
  VENUE_TYPE_LABEL,
  type VenueType,
} from "@/lib/venues/tour-venues";
import { BOWLER_STYLE, classifyBowlStyle } from "@/lib/venues/bowler-styles";
import { getTourStatScope, computeTourConsensus } from "@/lib/venues/consensus";
import { computeBatIndex, describeBatIndex, venueTypeFromBatIndex } from "@/lib/venues/bat-index";
import { canonicalVenue } from "@/lib/registry/venues";

// GET /api/venues?tour=<tournament_name>
// Returns per-ground behavior for a tour's venues: the Bat Index and its class, data-derived stats from match_performances (bat/bowl FP, boundaries, wickets,
// economy) + the venues-table innings scores, a CURATED spin/pace/seam profile, and recent
// matches at the ground. Read-only; safe on any auction.
export async function GET(request: NextRequest) {
  try {
    const tour = request.nextUrl.searchParams.get("tour") ?? "";
    const ctx = await getTourVenueContext(tour);
    if (!ctx) {
      return NextResponse.json({ error: "No venue model for this tour" }, { status: 404 });
    }

    // teamShort(s) whose home is this ground (Hundred). Empty for neutral festivals (LPL).
    const homeTeamsOf: Record<string, string[]> = {};
    for (const [team, home] of Object.entries(ctx.homeOf)) {
      if (home) (homeTeamsOf[home] ||= []).push(team);
    }

    const fmtPlaceholders = ctx.venueFormats.map(() => "?").join(",");
    // Descriptive "how it plays" stats (innings scores, boundaries, wickets, spin/pace split) use a
    // long 2020-onward window, because those are texture and want the biggest sample available.
    const SINCE = "2020-01-01";

    // The CLASS and the headline ratio come from the Bat Index instead — one source, so the badge
    // and the number underneath can never disagree. They did: the badge derived from the Bat Index
    // (2yr if >=15 matches, else 4yr) while this route printed its own ratio over 2020-onward, so
    // Warner Park displayed "Bat-friendly" next to a 0.85 ratio and a "<0.95 = bowl-friendly" note.
    // Venue no longer affects any price, so this is purely a reporting surface.
    // PERF: reuse the Bat Index getTourVenueContext() already computed (it decorates ctx.venues from
    // exactly this map) rather than re-scanning match_performances. Same object, same numbers.
    const { byGround: batIdx, median: batIdxMedian } =
      ctx.batIndexByGround
        ? { byGround: ctx.batIndexByGround, median: ctx.batIndexMedian ?? 1.0 }
        : await computeBatIndex(ctx.gender);

    // Tour-level bat vs bowl consensus — the SAME number shown on the auction header chip
    // (shared helper, scoped by the tour's format+gender), so the two never disagree.
    // It shares nothing with the per-venue reads, so it is fired off alongside them below.
    const scope = getTourStatScope(ctx.tour) ?? { formats: ctx.venueFormats, gender: ctx.gender };

    // PERF: every ground needs the same four independent queries. Instead of 4 sequential
    // round-trips per ground (each `.get()`/`.all()` is one network hop to Turso), all
    // 4 x nVenues statements go out as ONE `client.batch(..., "read")`. Results come back in the
    // order queued, so venue i owns indices [4i, 4i+3]. The SQL is untouched — same statements,
    // same params, just delivered in one packet.
    const stmts: Array<{ sql: string; args: Array<string> }> = [];
    for (const v of ctx.venues) {
      const vp = v.variants.map(() => "?").join(",");

      // 1) Character + aggregate behavior from ball-by-ball derived performances.
      stmts.push({
        sql: `SELECT
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
             AND mp.match_date >= ?`,
        args: [...v.variants, ...ctx.venueFormats, ctx.gender, SINCE],
      });

      // 2) Avg 1st-innings score from the seeded venues table (variants merged by mean). NOTE: the
      // venues table's avg_run_rate column is actually AVG(fantasy_points) (misnamed in seed_venues.py)
      // and avg_second_innings_score is only hand-seeded for a few grounds — so we deliberately DON'T
      // surface either; the real scoring rate comes from the computed bowling economy below.
      stmts.push({
        sql: `SELECT AVG(avg_first_innings_score) AS fis FROM venues WHERE name IN (${vp})`,
        args: [...v.variants],
      });

      // 3) Recent matches at the ground (aggregated per match) + its top fantasy performer.
      stmts.push({
        sql: `SELECT mp.match_id AS match_id,
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
           LIMIT 6`,
        args: [...v.variants, ...ctx.venueFormats, ctx.gender],
      });

      // 4) Spin vs pace effectiveness — sum wickets/runs/balls per bowler, classify via the
      // cricsheet_id-keyed style map, then derive average (runs/wkt), strike rate (balls/wkt) and
      // economy (runs/over) per type. Coverage = share of wickets where the bowler's style is known
      // (reported so a partial map stays honest). bowl_wickets excludes run-outs (bowler credits only).
      stmts.push({
        sql: `SELECT p.cricsheet_id AS cid,
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
           GROUP BY p.id`,
        args: [...v.variants, ...ctx.venueFormats, ctx.gender, SINCE],
      });
    }

    // One round-trip for all the per-venue stats; the tour consensus rides alongside it.
    const [batched, consensus] = await Promise.all([
      client.batch(stmts, "read"),
      computeTourConsensus(scope),
    ]);

    const aggOf = (i: number) => batched[i * 4].rows[0] as unknown as {
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
    const innsOf = (i: number) => batched[i * 4 + 1].rows[0] as unknown as { fis: number | null };
    const recentOf = (i: number) => batched[i * 4 + 2].rows as unknown as Array<{
      match_id: string;
      date: string;
      format: string;
      runs: number;
      sixes: number;
      wkts: number;
    }>;
    const wktRowsOf = (i: number) => batched[i * 4 + 3].rows as unknown as Array<{
      cid: string | null;
      bowl_style: string | null;
      w: number;
      r: number;
      b: number;
    }>;

    // Top performer per recent match. This query keys on match_id ONLY (no venue predicate), so the
    // per-ground lookups it used to do are folded into a single IN (...) over every ground's recent
    // match ids and grouped back in JS — one round-trip instead of one per ground.
    const allRecentIds = [...new Set(ctx.venues.flatMap((_, i) => recentOf(i).map((r) => r.match_id)))];
    const topByMatch: Record<string, { name: string; fp: number }> = {};
    if (allRecentIds.length) {
      const idPlaceholders = allRecentIds.map(() => "?").join(",");
      const tops = await sqlite
        .prepare(
          `SELECT match_id, name, fantasy_points FROM (
             SELECT mp.match_id AS match_id, p.name AS name, mp.fantasy_points AS fantasy_points,
               ROW_NUMBER() OVER (PARTITION BY mp.match_id ORDER BY mp.fantasy_points DESC) AS rn
             FROM match_performances mp
             JOIN players p ON mp.player_id = p.id
             WHERE mp.match_id IN (${idPlaceholders})
           ) WHERE rn = 1`
        )
        .all(...allRecentIds) as Array<{
        match_id: string;
        name: string;
        fantasy_points: number;
      }>;
      for (const t of tops) topByMatch[t.match_id] = { name: t.name, fp: t.fantasy_points };
    }

    const venues = ctx.venues.map((v, i) => {
      const agg = aggOf(i);
      const inns = innsOf(i);
      const recentRows = recentOf(i);
      const wktRows = wktRowsOf(i);

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

      const matches = agg.matches ?? 0;

      // Bat Index is the authority for the class and the headline bat/bowl numbers.
      const bi = batIdx.get(canonicalVenue(v.canonical));
      const usable = bi && bi.source !== "neutral";
      const type = (usable ? venueTypeFromBatIndex(bi!.batIndex, batIdxMedian) : v.type) as VenueType;
      const desc = usable ? describeBatIndex(bi!.batIndex, batIdxMedian) : null;
      const batFp = usable ? bi!.batFp : (agg.bat_fp ?? null);
      const bowlFp = usable ? bi!.bowlFp : (agg.bowl_fp ?? null);
      const ratio = usable ? bi!.batIndex : null;

      return {
        canonical: v.canonical,
        type,
        typeLabel: VENUE_TYPE_LABEL[type],
        // Bat Index block — the number, its sample, and how to read it
        batIndex: ratio != null ? Math.round(ratio * 1000) / 1000 : null,
        batIndexMedian: Math.round(batIdxMedian * 1000) / 1000,
        batIndexMatches: bi?.matches ?? null,
        batIndexWindow: bi?.source ?? null,
        whoEarnsMore: desc?.whoEarnsMore ?? null,
        earnsMorePct: desc?.earnsMorePct ?? null,
        vsAverageLabel: desc?.label ?? null,
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
