/**
 * Differential test: better-sqlite3 (the OLD driver) vs @libsql/client (the NEW one),
 * running the SAME queries against the SAME database file, comparing results deeply.
 *
 * This is the migration's real risk surface — not the SQL, which is unchanged, but how each
 * driver marshals values back: NULLs, INTEGER vs bigint, REAL precision, empty result sets,
 * positional-parameter binding, and `undefined` args (which better-sqlite3 rejected and the
 * shim now maps to NULL).
 *
 *   node scripts/driver-parity.mjs [path-to-db]
 */
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const DB = process.argv[2] || "db/cricket-auction.db";

const bs3 = new Database(DB, { readonly: true });
const libsql = createClient({ url: `file:${DB}` });

// Queries lifted from the real routes — the shapes that actually run in production.
const CASES = [
  ["auctions list", `SELECT id, name, status, num_friends, purse_per_friend FROM auctions ORDER BY id DESC LIMIT 5`, []],
  ["participants + purse", `SELECT id, name, short_name, purse, remaining_purse, is_me FROM auction_participants WHERE auction_id = ?`, [39]],
  ["pool join (the board query)", `SELECT ap.id, ap.player_id, ap.status, ap.sold_price, ap.val_expected, ap.efppm,
      ap.squad_number, ap.ipl_team, ap.risk_note, ap.availability, p.name, p.role, p.is_overseas
      FROM auction_pool ap JOIN players p ON p.id = ap.player_id WHERE ap.auction_id = ? ORDER BY ap.id LIMIT 60`, [39]],
  ["career stats (REAL cols)", `SELECT player_id, format, bat_matches, bat_runs, avg_fantasy_points, bat_avg, bat_sr, bowl_econ, bowl_avg FROM career_stats WHERE player_id = ? ORDER BY format`, [1]],
  ["recent matches", `SELECT match_date, format, opposition, venue_name, bat_runs, bat_balls, bowl_wickets, fantasy_points
      FROM match_performances WHERE player_id = ? ORDER BY match_date DESC LIMIT 40`, [1]],
  ["aggregate + CASE + CAST", `SELECT COUNT(*) AS matches, SUM(COALESCE(bat_runs,0)) AS runs,
      CASE WHEN SUM(COALESCE(bat_balls,0)) > 0 THEN CAST(SUM(COALESCE(bat_runs,0)) AS REAL)/SUM(COALESCE(bat_balls,0))*100 ELSE 0 END AS sr,
      AVG(COALESCE(fantasy_points,0)) AS afp FROM match_performances WHERE player_id = ?`, [1]],
  ["AVG returning NULL (empty set)", `SELECT AVG(fantasy_points) AS afp, COUNT(*) AS n FROM match_performances WHERE player_id = ?`, [-999]],
  ["IN clause, many params", `SELECT id, name FROM players WHERE id IN (?,?,?,?,?) ORDER BY id`, [1, 2, 3, 4, 5]],
  ["window function", `SELECT match_id, name, fantasy_points FROM (
        SELECT mp.match_id AS match_id, p.name AS name, mp.fantasy_points AS fantasy_points,
        ROW_NUMBER() OVER (PARTITION BY mp.match_id ORDER BY mp.fantasy_points DESC) AS rn
        FROM match_performances mp JOIN players p ON mp.player_id = p.id
        WHERE mp.format = 'CPL') WHERE rn = 1 ORDER BY match_id LIMIT 25`, []],
  ["venue bat/bowl ratio", `SELECT AVG(CASE WHEN p.role IN ('BAT','WK') THEN mp.fantasy_points END) AS bat_fp,
      AVG(CASE WHEN p.role = 'BOWL' THEN mp.fantasy_points END) AS bowl_fp, COUNT(DISTINCT mp.match_id) AS matches
      FROM match_performances mp JOIN players p ON mp.player_id = p.id
      WHERE mp.format = ? AND p.gender = ? AND mp.match_date >= ?`, ["CPL", "male", "2020-01-01"]],
  ["nullable text cols", `SELECT id, name, country, cricsheet_id, cricinfo_id, bowl_style, gender, is_overseas FROM players WHERE cricsheet_id IS NULL LIMIT 20`, []],
  ["group by + having", `SELECT format, COUNT(*) n, MAX(match_date) latest FROM match_performances GROUP BY format HAVING n > 1000 ORDER BY n DESC`, []],
  ["boolean-ish int flags", `SELECT id, is_me FROM auction_participants ORDER BY id LIMIT 20`, []],
  ["undefined -> NULL binding", `SELECT COUNT(*) n FROM auction_pool WHERE auction_id = ? AND sold_to_participant IS ?`, [39, undefined]],
];

// libsql returns Row objects with a non-plain prototype; normalize both sides to plain JSON.
const norm = (rows) =>
  JSON.parse(
    JSON.stringify(rows.map((r) => ({ ...r })), (_k, v) =>
      typeof v === "bigint" ? Number(v) : v
    )
  );

let pass = 0;
const failures = [];

for (const [label, sql, args] of CASES) {
  let a, b;
  try {
    a = norm(bs3.prepare(sql).all(...args.map((x) => (x === undefined ? null : x))));
  } catch (e) {
    failures.push(`${label}: better-sqlite3 threw ${e.message}`);
    continue;
  }
  try {
    const r = await libsql.execute({ sql, args: args.map((x) => (x === undefined ? null : x)) });
    b = norm(r.rows);
  } catch (e) {
    failures.push(`${label}: libsql threw ${e.message}`);
    continue;
  }

  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) {
    pass++;
    console.log(`  ✓ ${label}  (${a.length} rows)`);
  } else {
    failures.push(
      `${label}: MISMATCH\n    bs3   : ${sa.slice(0, 400)}\n    libsql: ${sb.slice(0, 400)}`
    );
    console.log(`  ✗ ${label}`);
  }
}

console.log(`\n${pass}/${CASES.length} queries identical across drivers`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Driver parity: PASS");
