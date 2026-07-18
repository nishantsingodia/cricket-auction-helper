import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { getTourVenueContext, buildTeamVenueSummaries } from "@/lib/venues/tour-venues";
import { getTourStatScope, computeTourConsensus } from "@/lib/venues/consensus";
import { LPL_2026_NAME, LPL_DISPLAY_NAMES } from "@/lib/squads/lpl-2026";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auctionId = Number(id);
    if (isNaN(auctionId)) {
      return NextResponse.json({ error: "Invalid auction ID" }, { status: 400 });
    }

    // Get auction details
    const auction = sqlite
      .prepare("SELECT * FROM auctions WHERE id = ?")
      .get(auctionId);

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // Get participants
    const participants = sqlite
      .prepare(
        `SELECT id, auction_id, name, short_name, color, purse, remaining_purse, is_me
         FROM auction_participants WHERE auction_id = ?
         ORDER BY is_me DESC, name`
      )
      .all(auctionId);

    // Get pool with player details (pick best career_stats: IPL first, then T20)
    const pool = sqlite
      .prepare(
        `SELECT ap.id as pool_id, ap.player_id, ap.base_price, ap.status,
                ap.sold_to_participant, ap.sold_price, ap.sold_at, ap.ipl_team, ap.squad_number,
                ap.efppm, ap.val_floor, ap.val_expected, ap.val_ceiling, ap.bowl_overs_avg, ap.availability, ap.risk_note,
                p.name, p.country, p.role, p.bat_style, p.bowl_style, p.is_overseas,
                cs.bat_matches as matches, cs.bat_runs as runs, cs.bat_avg, cs.bat_sr,
                cs.bat_50s as fifties, cs.bat_100s as hundreds, cs.bat_6s as sixes,
                cs.bowl_wickets as wickets, cs.bowl_avg, cs.bowl_econ,
                cs.catches, cs.avg_fantasy_points, cs.total_fantasy_points
         FROM auction_pool ap
         JOIN players p ON ap.player_id = p.id
         LEFT JOIN career_stats cs ON p.id = cs.player_id AND cs.id = (
           SELECT cs2.id FROM career_stats cs2
           WHERE cs2.player_id = p.id AND cs2.format IN ('IPL', 'T20')
           ORDER BY CASE cs2.format WHEN 'IPL' THEN 1 WHEN 'T20' THEN 2 END
           LIMIT 1
         )
         WHERE ap.auction_id = ?
         ORDER BY ap.ipl_team, ap.squad_number`
      )
      .all(auctionId);

    // LPL: render friendly announced names instead of unreadable cricsheet initials-forms
    // ("BKG Mendis" -> "Kusal Mendis"). Display-only; stats still come from player_id. Keep the
    // raw cricsheet name on `cricsheet_name` for reference. Other tours are unaffected.
    if ((auction as { tournament_name?: string }).tournament_name === LPL_2026_NAME) {
      for (const row of pool as Array<{ name: string; cricsheet_name?: string }>) {
        const friendly = LPL_DISPLAY_NAMES[row.name];
        if (friendly) {
          row.cricsheet_name = row.name;
          row.name = friendly;
        }
      }
    }

    // Get watchlist
    const watchlistItems = sqlite
      .prepare(
        `SELECT player_id, color, priority, notes FROM watchlist WHERE auction_id = ?`
      )
      .all(auctionId);

    // Build watchlist map
    const watchlistMap: Record<number, { color: string | null; priority: number; notes: string | null }> = {};
    for (const w of watchlistItems as { player_id: number; color: string | null; priority: number; notes: string | null }[]) {
      watchlistMap[w.player_id] = { color: w.color, priority: w.priority, notes: w.notes };
    }

    // Team pitch breakdown: classify venues then count per team schedule
    const venueClassRows = sqlite
      .prepare(
        `SELECT mp.venue_name,
          AVG(CASE WHEN p.role IN ('BAT','WK') THEN mp.fantasy_points END) as bat_fp,
          AVG(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points END) as bowl_fp
        FROM match_performances mp
        JOIN players p ON mp.player_id = p.id
        WHERE mp.match_date >= '2020-01-01'
          AND mp.format IN ('IPL', 'T20')
          AND p.gender = 'male'
        GROUP BY mp.venue_name
        HAVING COUNT(DISTINCT mp.match_id) >= 3`
      )
      .all() as Array<{ venue_name: string; bat_fp: number; bowl_fp: number }>;

    const venueType: Record<string, string> = {};
    for (const r of venueClassRows) {
      if (!r.bat_fp || !r.bowl_fp) continue;
      const ratio = r.bat_fp / r.bowl_fp;
      venueType[r.venue_name] = ratio > 1.1 ? "F" : ratio >= 0.95 ? "B" : "T";
    }

    // IPL 2026 Full League Stage Schedule (70 matches, 28 Mar – 24 May)
    const IPL_2026_SCHEDULE: Array<[string, string, string]> = [
      // Phase 1 (28 Mar – 12 Apr)
      ["RCB","SRH","Bengaluru"],["MI","KKR","Mumbai"],["RR","CSK","Guwahati"],
      ["PBKS","GT","Chandigarh"],["LSG","DC","Lucknow"],["KKR","SRH","Kolkata"],
      ["CSK","PBKS","Chennai"],["DC","MI","Delhi"],["GT","RR","Ahmedabad"],
      ["SRH","LSG","Hyderabad"],["RCB","CSK","Bengaluru"],["KKR","PBKS","Kolkata"],
      ["RR","MI","Guwahati"],["DC","GT","Delhi"],["KKR","LSG","Kolkata"],
      ["RR","RCB","Guwahati"],["PBKS","SRH","Chandigarh"],["CSK","DC","Chennai"],
      ["LSG","GT","Lucknow"],["MI","RCB","Mumbai"],
      // Phase 2 (13 Apr – 24 May)
      ["SRH","RR","Hyderabad"],["MI","CSK","Mumbai"],["SRH","RCB","Bengaluru"],
      ["MI","GT","Mumbai"],["CSK","RCB","Bengaluru"],["RCB","RR","Kolkata"],
      ["SRH","KKR","Chandigarh"],["GT","PBKS","Ahmedabad"],["KKR","LSG","Hyderabad"],
      ["PBKS","MI","Chandigarh"],["SRH","MI","Hyderabad"],["CSK","RR","Chennai"],
      ["RCB","KKR","Bengaluru"],["DC","PBKS","Delhi"],["GT","CSK","Ahmedabad"],
      ["LSG","SRH","Lucknow"],["MI","RCB","Mumbai"],["RR","DC","Jaipur"],
      ["KKR","GT","Kolkata"],["PBKS","LSG","Chandigarh"],["SRH","CSK","Hyderabad"],
      ["RR","MI","Jaipur"],["RCB","DC","Bengaluru"],["GT","PBKS","Ahmedabad"],
      ["KKR","LSG","Kolkata"],["CSK","MI","Chennai"],["SRH","RCB","Hyderabad"],
      ["DC","RR","Delhi"],["LSG","KKR","Lucknow"],["PBKS","GT","Dharamsala"],
      ["MI","SRH","Mumbai"],["CSK","DC","Chennai"],["RR","PBKS","Jaipur"],
      ["RCB","GT","Raipur"],["LSG","MI","Lucknow"],["KKR","SRH","Kolkata"],
      ["DC","RCB","Delhi"],["GT","RR","Ahmedabad"],["PBKS","CSK","Dharamsala"],
      ["MI","KKR","Mumbai"],["SRH","LSG","Hyderabad"],["RCB","PBKS","Raipur"],
      ["CSK","GT","Chennai"],["RR","KKR","Jaipur"],["DC","LSG","Delhi"],
      ["MI","GT","Mumbai"],["SRH","PBKS","Hyderabad"],["SRH","RCB","Hyderabad"],
      ["LSG","PBKS","Lucknow"],["MI","RR","Mumbai"],["KKR","DC","Kolkata"],
    ];

    // Map city names to DB venue names for classification
    const CITY_TO_VENUE: Record<string, string> = {
      "Bengaluru":  "M Chinnaswamy Stadium, Bengaluru",
      "Mumbai":     "Wankhede Stadium, Mumbai",
      "Guwahati":   "Barsapara Cricket Stadium, Guwahati",
      "Chandigarh": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur",
      "Lucknow":    "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow",
      "Kolkata":    "Eden Gardens, Kolkata",
      "Chennai":    "MA Chidambaram Stadium, Chepauk, Chennai",
      "Delhi":      "Arun Jaitley Stadium, Delhi",
      "Ahmedabad":  "Narendra Modi Stadium, Ahmedabad",
      "Hyderabad":  "Rajiv Gandhi International Stadium, Uppal, Hyderabad",
      "Jaipur":     "Sawai Mansingh Stadium, Jaipur",
      "Dharamsala":  "Himachal Pradesh Cricket Association Stadium, Dharamsala",
      "Raipur":     "Shaheed Veer Narayan Singh International Stadium, Raipur",
    };

    // Count pitch types per team from IPL 2026 schedule
    const teamPitchBreakdown: Record<string, { F: number; B: number; T: number }> = {};
    for (const [t1, t2, city] of IPL_2026_SCHEDULE) {
      const venueName = CITY_TO_VENUE[city] || city;
      const vt = venueType[venueName] || "B";
      for (const team of [t1, t2]) {
        if (!teamPitchBreakdown[team]) teamPitchBreakdown[team] = { F: 0, B: 0, T: 0 };
        if (vt === "F") teamPitchBreakdown[team].F += 1;
        else if (vt === "T") teamPitchBreakdown[team].T += 1;
        else teamPitchBreakdown[team].B += 1;
      }
    }

    // Per-team venue summary (home ground + games + bat/bowl character) — Hundred & LPL for now.
    // Reads the SAME schedules + authoritative venue classes the EFPPM engine uses (#transparency).
    // IPL keeps its inline teamPitchBreakdown above; other tours fall through to null.
    const tourName = (auction as { tournament_name?: string }).tournament_name ?? "";
    const venueCtx = getTourVenueContext(tourName);
    const teamVenueSummary = venueCtx ? buildTeamVenueSummaries(venueCtx) : null;

    // Tour-level bat/bowl "general stats" for the header chip (works for all tours, venue or not).
    const statScope = getTourStatScope(tourName);
    const tourConsensus = statScope ? computeTourConsensus(statScope) : null;

    return NextResponse.json({
      auction,
      participants,
      pool,
      watchlist: watchlistMap,
      teamPitchBreakdown,
      teamVenueSummary,
      hasVenueView: !!venueCtx,
      tourConsensus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auctionId = Number(id);
    if (isNaN(auctionId)) {
      return NextResponse.json({ error: "Invalid auction ID" }, { status: 400 });
    }

    const body = await request.json();
    const allowed = ["name", "num_friends", "purse_per_friend", "players_per_friend", "num_captains", "num_vice_captains"];
    const updates: string[] = [];
    const values: (string | number)[] = [];

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    values.push(auctionId);
    sqlite
      .prepare(`UPDATE auctions SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values);

    // If purse changed, update participants' purse and remaining_purse
    // remaining_purse adjusts by the same delta (so spent amount is preserved)
    if ("purse_per_friend" in body) {
      const newPurse = body.purse_per_friend;
      sqlite
        .prepare(
          `UPDATE auction_participants
           SET remaining_purse = remaining_purse + (? - purse),
               purse = ?
           WHERE auction_id = ?`
        )
        .run(newPurse, newPurse, auctionId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
