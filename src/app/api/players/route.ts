import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";
import { players, careerStats } from "@/db/schema";
import { eq, like, and, desc, asc, sql, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";
  const format = searchParams.get("format") || "IPL";
  const sortBy = searchParams.get("sortBy") || "efppm";
  const sortDir = searchParams.get("sortDir") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const minMatches = parseInt(searchParams.get("minMatches") || "5");
  const country = searchParams.get("country") || "";

  const offset = (page - 1) * limit;

  // Build SQL directly for complex joins with aggregations
  let whereClause = `WHERE cs.format = ?`;
  const params: (string | number)[] = [format];

  if (search) {
    whereClause += ` AND p.name LIKE ?`;
    params.push(`%${search}%`);
  }
  if (role) {
    whereClause += ` AND p.role = ?`;
    params.push(role);
  }
  if (country) {
    whereClause += ` AND p.country = ?`;
    params.push(country);
  }
  if (minMatches > 0) {
    whereClause += ` AND cs.bat_matches >= ?`;
    params.push(minMatches);
  }

  // Map sortBy to column
  const sortColumn: Record<string, string> = {
    efppm: "cs.avg_fantasy_points",
    name: "p.name",
    batAvg: "cs.bat_avg",
    batSr: "cs.bat_sr",
    bowlWickets: "cs.bowl_wickets",
    bowlEcon: "cs.bowl_econ",
    matches: "cs.bat_matches",
    totalPoints: "cs.total_fantasy_points",
  };

  const col = sortColumn[sortBy] || "cs.avg_fantasy_points";
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  const query = `
    SELECT
      p.id, p.name, p.country, p.role, p.bat_style, p.bowl_style, p.is_overseas, p.dob,
      cs.format, cs.bat_matches, cs.bat_innings, cs.bat_runs, cs.bat_avg, cs.bat_sr,
      cs.bat_50s, cs.bat_100s, cs.bat_hs, cs.bat_4s, cs.bat_6s,
      cs.bowl_innings, cs.bowl_wickets, cs.bowl_avg, cs.bowl_econ, cs.bowl_sr, cs.bowl_best,
      cs.catches, cs.stumpings,
      cs.avg_fantasy_points, cs.total_fantasy_points
    FROM career_stats cs
    JOIN players p ON cs.player_id = p.id
    ${whereClause}
    ORDER BY ${col} ${dir}
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const rows = sqlite.prepare(query).all(...params) as Record<string, unknown>[];

  // Count total
  const countQuery = `
    SELECT COUNT(*) as total
    FROM career_stats cs
    JOIN players p ON cs.player_id = p.id
    ${whereClause}
  `;
  const countParams = params.slice(0, -2); // remove limit/offset
  const totalRow = sqlite.prepare(countQuery).get(...countParams) as { total: number };

  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    role: r.role,
    batStyle: r.bat_style,
    bowlStyle: r.bowl_style,
    isOverseas: r.is_overseas,
    dob: r.dob,
    format: r.format,
    stats: {
      matches: r.bat_matches,
      innings: r.bat_innings,
      runs: r.bat_runs,
      batAvg: r.bat_avg,
      batSr: r.bat_sr,
      fifties: r.bat_50s,
      hundreds: r.bat_100s,
      hs: r.bat_hs,
      fours: r.bat_4s,
      sixes: r.bat_6s,
      bowlInnings: r.bowl_innings,
      wickets: r.bowl_wickets,
      bowlAvg: r.bowl_avg,
      bowlEcon: r.bowl_econ,
      bowlSr: r.bowl_sr,
      bowlBest: r.bowl_best,
      catches: r.catches,
      stumpings: r.stumpings,
    },
    fantasy: {
      efppm: r.avg_fantasy_points,
      totalPoints: r.total_fantasy_points,
    },
  }));

  return NextResponse.json({
    players: result,
    pagination: {
      page,
      limit,
      total: totalRow.total,
      totalPages: Math.ceil(totalRow.total / limit),
    },
  });
}
