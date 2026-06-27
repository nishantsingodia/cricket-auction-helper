import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(escapeCsvValue).join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeCsvValue(row[col])).join(","))
    .join("\n");
  return header + "\n" + body + "\n";
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function exportSummary(tournamentId: string): NextResponse {
  const tid = Number(tournamentId);
  if (isNaN(tid)) {
    return NextResponse.json(
      { error: "tournamentId must be a number" },
      { status: 400 }
    );
  }

  const rows = sqlite
    .prepare(
      `SELECT p.name, p.role, p.is_overseas, p.country,
              ap.sold_price, ap.expected_price, ap.efppm, ap.status,
              tt.name as team_name, tt.short_name
       FROM auction_pool ap
       JOIN players p ON ap.player_id = p.id
       LEFT JOIN tournament_teams tt ON ap.sold_to_team = tt.id
       WHERE ap.tournament_id = ?
       ORDER BY tt.name, ap.efppm DESC`
    )
    .all(tid) as Record<string, unknown>[];

  const columns = [
    "team_name",
    "short_name",
    "name",
    "role",
    "is_overseas",
    "country",
    "sold_price",
    "expected_price",
    "efppm",
    "status",
  ];

  const csv = rowsToCsv(columns, rows);
  return csvResponse(csv, `auction-summary-${tid}.csv`);
}

function exportPlayers(format: string, minMatches: string): NextResponse {
  const min = Number(minMatches);
  if (isNaN(min)) {
    return NextResponse.json(
      { error: "minMatches must be a number" },
      { status: 400 }
    );
  }

  const rows = sqlite
    .prepare(
      `SELECT p.name, p.country, p.role, p.bat_style, p.bowl_style, p.is_overseas,
              cs.format, cs.bat_matches, cs.bat_runs, cs.bat_avg, cs.bat_sr, cs.bat_50s, cs.bat_100s,
              cs.bowl_wickets, cs.bowl_avg, cs.bowl_econ, cs.avg_fantasy_points, cs.total_fantasy_points
       FROM players p
       LEFT JOIN career_stats cs ON p.id = cs.player_id AND cs.format = ?
       WHERE cs.bat_matches >= ?
       ORDER BY cs.avg_fantasy_points DESC`
    )
    .all(format, min) as Record<string, unknown>[];

  const columns = [
    "name",
    "country",
    "role",
    "bat_style",
    "bowl_style",
    "is_overseas",
    "format",
    "bat_matches",
    "bat_runs",
    "bat_avg",
    "bat_sr",
    "bat_50s",
    "bat_100s",
    "bowl_wickets",
    "bowl_avg",
    "bowl_econ",
    "avg_fantasy_points",
    "total_fantasy_points",
  ];

  const csv = rowsToCsv(columns, rows);
  return csvResponse(csv, `players-${format}-min${min}.csv`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");

  try {
    if (type === "summary") {
      const tournamentId = searchParams.get("tournamentId");
      if (!tournamentId) {
        return NextResponse.json(
          { error: "tournamentId is required for summary export" },
          { status: 400 }
        );
      }
      return exportSummary(tournamentId);
    }

    if (type === "players") {
      const format = searchParams.get("format") || "IPL";
      const minMatches = searchParams.get("minMatches") || "0";
      return exportPlayers(format, minMatches);
    }

    return NextResponse.json(
      { error: 'Invalid type. Use "summary" or "players".' },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
