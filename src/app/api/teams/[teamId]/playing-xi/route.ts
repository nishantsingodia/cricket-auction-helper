import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

interface PoolPlayer {
  player_id: number;
  player_name: string;
  country: string;
  role: "BAT" | "BOWL" | "AR" | "WK";
  bat_style: string | null;
  bowl_style: string | null;
  is_overseas: number;
  availability: string;
  efppm: number | null;
  career_efppm: number | null;
  sold_price: number | null;
}

interface XIPlayer {
  id: number;
  name: string;
  role: string;
  country: string;
  isOverseas: boolean;
  efppm: number;
  availability: string;
  isCaptainCandidate: boolean;
  soldPrice: number | null;
}

function getEffectiveEfppm(p: PoolPlayer): number {
  const raw = p.efppm ?? p.career_efppm ?? 0;
  if (p.availability === "DOUBTFUL") return raw * 0.5;
  return raw;
}

function canBowl(p: PoolPlayer): boolean {
  return p.role === "BOWL" || (p.role === "AR" && !!p.bowl_style);
}

function toXIPlayer(p: PoolPlayer, isCaptainCandidate: boolean): XIPlayer {
  return {
    id: p.player_id,
    name: p.player_name,
    role: p.role,
    country: p.country,
    isOverseas: !!p.is_overseas,
    efppm: getEffectiveEfppm(p),
    availability: p.availability,
    isCaptainCandidate,
    soldPrice: p.sold_price,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const tournamentId = req.nextUrl.searchParams.get("tournamentId");

  if (!tournamentId) {
    return NextResponse.json(
      { error: "tournamentId required" },
      { status: 400 }
    );
  }

  // Get tournament config
  const tournament = sqlite
    .prepare("SELECT * FROM tournaments WHERE id = ?")
    .get(tournamentId) as Record<string, unknown> | undefined;

  if (!tournament) {
    return NextResponse.json(
      { error: "Tournament not found" },
      { status: 404 }
    );
  }

  // Get team info
  const team = sqlite
    .prepare("SELECT * FROM tournament_teams WHERE id = ? AND tournament_id = ?")
    .get(teamId, tournamentId) as Record<string, unknown> | undefined;

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const maxOverseas = (tournament.max_overseas as number) ?? 4;
  // Lineup size: IPL fields 12 (the Impact Player rule lets a 12th player be
  // substituted in). Every other format — MLC, Women's WC, bilateral — has no
  // Impact Player, so the lineup is a standard XI of 11.
  const lineupSize = (tournament.format as string) === "IPL" ? 12 : 11;
  const statsFormat =
    (tournament.match_format as string) === "T20" ? "IPL" : (tournament.match_format as string);

  // Step 1: Get all SOLD players for this team
  const allSold = sqlite
    .prepare(
      `
      SELECT
        ap.player_id,
        p.name AS player_name,
        p.country,
        p.role,
        p.bat_style,
        p.bowl_style,
        p.is_overseas,
        ap.availability,
        ap.efppm,
        ap.sold_price,
        cs.avg_fantasy_points AS career_efppm
      FROM auction_pool ap
      JOIN players p ON ap.player_id = p.id
      LEFT JOIN career_stats cs ON cs.player_id = p.id AND cs.format = ?
      WHERE ap.tournament_id = ?
        AND ap.sold_to_team = ?
        AND ap.status = 'SOLD'
      ORDER BY COALESCE(ap.efppm, cs.avg_fantasy_points, 0) DESC
    `
    )
    .all(statsFormat, tournamentId, teamId) as PoolPlayer[];

  // Step 2: Filter out INJURED and UNAVAILABLE
  const available = allSold.filter(
    (p) => p.availability !== "INJURED" && p.availability !== "UNAVAILABLE"
  );
  const unavailablePlayers = allSold.filter(
    (p) => p.availability === "INJURED" || p.availability === "UNAVAILABLE"
  );

  const warnings: string[] = [];

  if (available.length < lineupSize) {
    warnings.push(
      `Only ${available.length} players available (need ${lineupSize}).`
    );
  }

  // Sort by effective EFPPM
  const sorted = [...available].sort(
    (a, b) => getEffectiveEfppm(b) - getEffectiveEfppm(a)
  );

  // Step 3: Greedy selection
  const xi: PoolPlayer[] = [];
  const used = new Set<number>();

  function pickBest(
    pool: PoolPlayer[],
    filterFn: (p: PoolPlayer) => boolean,
    count: number
  ): PoolPlayer[] {
    const picked: PoolPlayer[] = [];
    for (const p of pool) {
      if (picked.length >= count) break;
      if (!used.has(p.player_id) && filterFn(p)) {
        picked.push(p);
        used.add(p.player_id);
      }
    }
    return picked;
  }

  // Must have: at least 1 WK
  const wks = pickBest(sorted, (p) => p.role === "WK", 1);
  xi.push(...wks);
  if (wks.length < 1) warnings.push("No wicketkeeper available in squad");

  // Must have: at least 3 pure BAT
  const bats = pickBest(sorted, (p) => p.role === "BAT", 3);
  xi.push(...bats);
  if (bats.length < 3)
    warnings.push(`Only ${bats.length} pure batters available (need 3)`);

  // Must have: at least 3 pure BOWL
  const bowls = pickBest(sorted, (p) => p.role === "BOWL", 3);
  xi.push(...bowls);
  if (bowls.length < 3)
    warnings.push(`Only ${bowls.length} pure bowlers available (need 3)`);

  // Fill remaining slots (prefer AR, then anyone), up to the lineup size
  const remaining = lineupSize - xi.length;
  if (remaining > 0) {
    // Prefer all-rounders first
    const ars = pickBest(sorted, (p) => p.role === "AR", remaining);
    xi.push(...ars);

    const stillNeeded = lineupSize - xi.length;
    if (stillNeeded > 0) {
      const fillers = pickBest(sorted, () => true, stillNeeded);
      xi.push(...fillers);
    }
  }

  // Step 4: Verify overseas constraint
  let overseasCount = xi.filter((p) => p.is_overseas).length;
  while (overseasCount > maxOverseas) {
    // Find lowest-EFPPM overseas player in XI
    const overseasInXI = xi
      .filter((p) => p.is_overseas)
      .sort((a, b) => getEffectiveEfppm(a) - getEffectiveEfppm(b));
    const weakest = overseasInXI[0];

    // Find best domestic replacement not in XI
    const domesticReplacement = sorted.find(
      (p) => !used.has(p.player_id) && !p.is_overseas
    );

    if (!domesticReplacement) {
      warnings.push(
        `${overseasCount} overseas in XI (max ${maxOverseas}) - no domestic replacement available`
      );
      break;
    }

    // Swap
    const idx = xi.findIndex((p) => p.player_id === weakest.player_id);
    used.delete(weakest.player_id);
    xi[idx] = domesticReplacement;
    used.add(domesticReplacement.player_id);
    overseasCount = xi.filter((p) => p.is_overseas).length;
  }

  if (overseasCount > 0 && overseasCount <= maxOverseas) {
    // Informational, not a warning
  }

  // Step 5: Verify 5+ bowling options
  let bowlingOptions = xi.filter((p) => canBowl(p)).length;
  while (bowlingOptions < 5) {
    // Find lowest-EFPPM non-bowler in XI
    const nonBowlers = xi
      .filter((p) => !canBowl(p))
      .sort((a, b) => getEffectiveEfppm(a) - getEffectiveEfppm(b));

    if (nonBowlers.length === 0) break;
    const weakest = nonBowlers[0];

    // Find best available BOWL or AR not in XI
    const bowlerReplacement = sorted.find(
      (p) => !used.has(p.player_id) && canBowl(p)
    );

    if (!bowlerReplacement) {
      warnings.push(
        `Only ${bowlingOptions} bowling options in XI (recommended 5)`
      );
      break;
    }

    // Swap
    const idx = xi.findIndex((p) => p.player_id === weakest.player_id);
    used.delete(weakest.player_id);
    xi[idx] = bowlerReplacement;
    used.add(bowlerReplacement.player_id);
    bowlingOptions = xi.filter((p) => canBowl(p)).length;
  }

  // Re-check overseas after bowling swap
  const finalOverseas = xi.filter((p) => p.is_overseas).length;
  if (finalOverseas > maxOverseas) {
    warnings.push(
      `${finalOverseas} overseas in XI after bowling adjustments (max ${maxOverseas})`
    );
  }

  // Sort XI by role order: WK, BAT, AR, BOWL
  const roleOrder: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };
  xi.sort((a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4));

  // Determine captain candidates (top 2 EFPPM in XI)
  const xiByEfppm = [...xi].sort(
    (a, b) => getEffectiveEfppm(b) - getEffectiveEfppm(a)
  );
  const captainCandidateIds = new Set(
    xiByEfppm.slice(0, 2).map((p) => p.player_id)
  );

  // Build response
  const xiResult = xi.map((p) =>
    toXIPlayer(p, captainCandidateIds.has(p.player_id))
  );

  const bench = available
    .filter((p) => !used.has(p.player_id))
    .sort((a, b) => getEffectiveEfppm(b) - getEffectiveEfppm(a))
    .map((p) => toXIPlayer(p, false));

  const unavailable = unavailablePlayers.map((p) => toXIPlayer(p, false));

  // Squad composition stats
  const allSquad = allSold;
  const squadStats = {
    total: allSquad.length,
    bat: allSquad.filter((p) => p.role === "BAT").length,
    bowl: allSquad.filter((p) => p.role === "BOWL").length,
    ar: allSquad.filter((p) => p.role === "AR").length,
    wk: allSquad.filter((p) => p.role === "WK").length,
    overseas: allSquad.filter((p) => p.is_overseas).length,
    maxOverseasSquad: (tournament.max_overseas_squad as number) ?? 8,
    totalEfppm: allSquad.reduce((sum, p) => sum + getEffectiveEfppm(p), 0),
  };

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      shortName: team.short_name,
      color: team.color,
      remainingPurse: team.remaining_purse,
    },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      maxOverseas,
      maxSquadSize: tournament.max_squad_size,
    },
    xi: xiResult,
    bench,
    unavailable,
    warnings,
    squadStats,
    fullSquad: allSold.map((p) => ({
      ...toXIPlayer(p, false),
      soldPrice: p.sold_price,
    })),
  });
}
