#!/usr/bin/env python3
"""
ETL pipeline: Parse Cricsheet JSON match files → SQLite database.
Computes Dream11 T20 fantasy points for every player × match.
"""

import os
import sys
import json
import glob
import sqlite3
from collections import defaultdict
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "db", "cricket-auction.db")
RAW_DIR = os.path.join(os.path.dirname(__file__), "raw")

# Franchise T20 leagues bucketed by their raw FOLDER (event.name varies across seasons —
# esp. Vitality Blast: "Vitality Blast"/"NatWest t20 Blast"/older — so folder is the robust
# signal). Existing folders (ipl/t20i/wpl/mlc/hundred/lpl/odi) keep using detect_format().
FOLDER_FORMAT = {
    "bbl": "BBL", "blast": "BLAST", "psl": "PSL",
    "sa20": "SA20", "ilt20": "ILT20", "cpl": "CPL",
    "wbbl": "WBBL",  # Women's Big Bash League (women-only 20-over; T20 scorer)
}

# ==================== DREAM11 T20 FANTASY POINTS ====================

def compute_fantasy_points(perf: dict, role: str) -> float:
    """
    Compute Dream11 T20 fantasy points from a player's match performance.

    perf keys: bat_runs, bat_balls, bat_4s, bat_6s, bat_dismissed, dismissal_type,
               bowl_balls, bowl_runs, bowl_wickets, bowl_maidens, bowl_dots, bowl_lbw_bowled,
               catches, stumpings, run_outs, direct_run_outs
    """
    pts = 0.0

    # === BATTING ===
    bat_runs = perf.get("bat_runs", 0) or 0
    bat_balls = perf.get("bat_balls", 0) or 0
    bat_4s = perf.get("bat_4s", 0) or 0
    bat_6s = perf.get("bat_6s", 0) or 0
    bat_dismissed = perf.get("bat_dismissed", False)

    if bat_balls > 0 or bat_runs > 0:
        # Per run
        pts += bat_runs * 1

        # Boundary bonus: +4 per four (total 8 per four = 4 run + 4 bonus)
        pts += bat_4s * 4

        # Six bonus: +6 per six (total 12 per six = 6 run + 6 bonus)
        pts += bat_6s * 6

        # Milestone bonuses (century replaces all lower)
        if bat_runs >= 100:
            pts += 16  # Century only
        elif bat_runs >= 75:
            pts += 12 + 8 + 4  # 75 + 50 + 25
        elif bat_runs >= 50:
            pts += 8 + 4  # 50 + 25
        elif bat_runs >= 25:
            pts += 4  # 25

        # Duck penalty (for BAT, WK, AR — not pure bowlers)
        if bat_dismissed and bat_runs == 0 and role in ("BAT", "WK", "AR"):
            pts -= 2

        # Strike rate bonus/penalty (min 10 balls, excludes bowlers)
        if bat_balls >= 10 and role != "BOWL":
            sr = (bat_runs / bat_balls) * 100
            if sr > 170:
                pts += 6
            elif sr > 150:
                pts += 4
            elif sr >= 130:
                pts += 2
            elif 60 <= sr <= 70:
                pts -= 2
            elif 50 <= sr < 60:
                pts -= 4
            elif sr < 50:
                pts -= 6

    # === BOWLING ===
    bowl_balls = perf.get("bowl_balls", 0) or 0
    bowl_runs_conceded = perf.get("bowl_runs", 0) or 0
    bowl_wickets = perf.get("bowl_wickets", 0) or 0
    bowl_maidens = perf.get("bowl_maidens", 0) or 0
    bowl_dots = perf.get("bowl_dots", 0) or 0
    bowl_lbw_bowled = perf.get("bowl_lbw_bowled", 0) or 0

    if bowl_balls > 0:
        # Per wicket: +30
        pts += bowl_wickets * 30

        # LBW/Bowled bonus: +8 per such wicket
        pts += bowl_lbw_bowled * 8

        # Dot ball: +1
        pts += bowl_dots * 1

        # Maiden over: +12
        pts += bowl_maidens * 12

        # Wicket haul bonuses
        if bowl_wickets >= 5:
            pts += 12
        elif bowl_wickets >= 4:
            pts += 8
        elif bowl_wickets >= 3:
            pts += 4

        # Economy rate bonus/penalty (min 2 overs = 12 balls)
        if bowl_balls >= 12:
            overs = bowl_balls / 6
            econ = bowl_runs_conceded / overs
            if econ < 5:
                pts += 6
            elif econ < 6:
                pts += 4
            elif econ <= 7:
                pts += 2
            elif 10 <= econ <= 11:
                pts -= 2
            elif 11 < econ <= 12:
                pts -= 4
            elif econ > 12:
                pts -= 6

    # === FIELDING ===
    catches = perf.get("catches", 0) or 0
    stumpings = perf.get("stumpings", 0) or 0
    run_outs = perf.get("run_outs", 0) or 0
    direct_run_outs = perf.get("direct_run_outs", 0) or 0

    # Catch: +8
    pts += catches * 8
    # 3-catch bonus: +4
    if catches >= 3:
        pts += 4

    # Stumping: +12
    pts += stumpings * 12

    # Run out (direct hit): +12, not direct: +6
    pts += direct_run_outs * 12
    pts += (run_outs - direct_run_outs) * 6

    # Starting XI bonus: +4 (assumed all players in match data played)
    pts += 4

    return pts


def compute_fantasy_points_hundred(perf: dict, role: str) -> float:
    """Dream11 'The Hundred' FPS (per Nishant's config, Jul 2026).
    Same core scale as the T20 scorer (run+1, four+4, six+6, wicket+30, dot+1) EXCEPT:
      - NO strike-rate, NO economy, NO maiden points (The Hundred awards none).
      - Milestones (TIERED, highest only): 25 -> +4, 50 -> +8, 75 -> +12, 100 -> +16.
      - Wicket hauls (TIERED, highest only): 2w -> +4, 3w -> +8, 4w -> +12, 5w+ -> +16.
    """
    pts = 0.0
    # === BATTING ===
    bat_runs = perf.get("bat_runs", 0) or 0
    bat_balls = perf.get("bat_balls", 0) or 0
    bat_4s = perf.get("bat_4s", 0) or 0
    bat_6s = perf.get("bat_6s", 0) or 0
    bat_dismissed = perf.get("bat_dismissed", False)
    if bat_balls > 0 or bat_runs > 0:
        pts += bat_runs * 1 + bat_4s * 4 + bat_6s * 6
        if bat_runs >= 100:
            pts += 16
        elif bat_runs >= 75:
            pts += 12
        elif bat_runs >= 50:
            pts += 8
        elif bat_runs >= 25:
            pts += 4
        if bat_dismissed and bat_runs == 0 and role in ("BAT", "WK", "AR"):
            pts -= 2
        # No strike-rate points in The Hundred.

    # === BOWLING (no maiden, no economy) ===
    bowl_balls = perf.get("bowl_balls", 0) or 0
    bowl_wickets = perf.get("bowl_wickets", 0) or 0
    bowl_dots = perf.get("bowl_dots", 0) or 0
    bowl_lbw_bowled = perf.get("bowl_lbw_bowled", 0) or 0
    if bowl_balls > 0:
        pts += bowl_wickets * 30 + bowl_lbw_bowled * 8 + bowl_dots * 1
        if bowl_wickets >= 5:
            pts += 16
        elif bowl_wickets >= 4:
            pts += 12
        elif bowl_wickets >= 3:
            pts += 8
        elif bowl_wickets >= 2:
            pts += 4
        # No maiden, no economy points in The Hundred.

    # === FIELDING ===
    catches = perf.get("catches", 0) or 0
    stumpings = perf.get("stumpings", 0) or 0
    run_outs = perf.get("run_outs", 0) or 0
    direct_run_outs = perf.get("direct_run_outs", 0) or 0
    pts += catches * 8
    if catches >= 3:
        pts += 4
    pts += stumpings * 12
    pts += direct_run_outs * 12 + (run_outs - direct_run_outs) * 6  # indirect run-out +6

    pts += 4  # announced XI
    return pts


def compute_fantasy_points_odi(perf: dict, role: str) -> float:
    """Dream11 ODI / One-Day FPS (per Nishant's config, Jul 2026).
    Mirrors ODI_RULES in src/lib/fantasy-points/rules.ts and the bot's ODI path.
    Differs from the T20 scorer:
      - Duck -3 (T20 -2), awarded OUTSIDE the runs/balls gate (0-off-0 run-out still counts).
      - Dot ball: +1 for every 3 dot balls (floored); T20 is +1 per dot.
      - Maiden over +4 (T20 +12).
      - Wicket hauls start at 4w: 4w/5w/6w = +4/+8/+12 (T20 is 3w/4w/5w).
      - Milestones HIGHEST-only (25/50/75/100 = 4/8/12/16) — matches the live bot; the T20
        scorer above is cumulative (a known divergence, left as-is for T20).
      - SR bands >140 / 120.1-140 / 100-120 & 40-50 / 30-39.99 / <30 at min 20 balls.
      - Economy <2.5 / 2.5-3.49 / 3.5-4.5 & 7-8 / 8.01-9 / >9 at min 5 overs (30 balls).
    Batting run/boundary/six and all fielding values are identical to T20.
    """
    pts = 0.0

    # === BATTING ===
    bat_runs = perf.get("bat_runs", 0) or 0
    bat_balls = perf.get("bat_balls", 0) or 0
    bat_4s = perf.get("bat_4s", 0) or 0
    bat_6s = perf.get("bat_6s", 0) or 0
    bat_dismissed = perf.get("bat_dismissed", False)

    if bat_balls > 0 or bat_runs > 0:
        pts += bat_runs * 1 + bat_4s * 4 + bat_6s * 6
        # Milestone (highest only)
        if bat_runs >= 100:
            pts += 16
        elif bat_runs >= 75:
            pts += 12
        elif bat_runs >= 50:
            pts += 8
        elif bat_runs >= 25:
            pts += 4
        # Strike rate (min 20 balls, excludes pure bowlers)
        if bat_balls >= 20 and role != "BOWL":
            sr = (bat_runs / bat_balls) * 100
            if sr > 140:
                pts += 6
            elif sr > 120:
                pts += 4
            elif sr >= 100:
                pts += 2
            elif 40 <= sr <= 50:
                pts -= 2
            elif 30 <= sr < 40:
                pts -= 4
            elif sr < 30:
                pts -= 6

    # Duck (-3, BAT/WK/AR only) — OUTSIDE the gate so a 0-off-0 run-out still counts.
    if bat_dismissed and bat_runs == 0 and role in ("BAT", "WK", "AR"):
        pts -= 3

    # === BOWLING ===
    bowl_balls = perf.get("bowl_balls", 0) or 0
    bowl_runs_conceded = perf.get("bowl_runs", 0) or 0
    bowl_wickets = perf.get("bowl_wickets", 0) or 0
    bowl_maidens = perf.get("bowl_maidens", 0) or 0
    bowl_dots = perf.get("bowl_dots", 0) or 0
    bowl_lbw_bowled = perf.get("bowl_lbw_bowled", 0) or 0

    if bowl_balls > 0:
        pts += bowl_wickets * 30 + bowl_lbw_bowled * 8
        pts += (bowl_dots // 3) * 1  # +1 for every 3 dot balls
        pts += bowl_maidens * 4
        if bowl_wickets >= 6:
            pts += 12
        elif bowl_wickets >= 5:
            pts += 8
        elif bowl_wickets >= 4:
            pts += 4
        # Economy (min 5 overs = 30 balls)
        if bowl_balls >= 30:
            econ = bowl_runs_conceded / (bowl_balls / 6)
            if econ < 2.5:
                pts += 6
            elif econ < 3.5:
                pts += 4
            elif econ <= 4.5:
                pts += 2
            elif 7 <= econ <= 8:
                pts -= 2
            elif 8 < econ <= 9:
                pts -= 4
            elif econ > 9:
                pts -= 6

    # === FIELDING === (identical to T20)
    catches = perf.get("catches", 0) or 0
    stumpings = perf.get("stumpings", 0) or 0
    run_outs = perf.get("run_outs", 0) or 0
    direct_run_outs = perf.get("direct_run_outs", 0) or 0
    pts += catches * 8
    if catches >= 3:
        pts += 4
    pts += stumpings * 12
    pts += direct_run_outs * 12 + (run_outs - direct_run_outs) * 6

    pts += 4  # announced XI
    return pts


def score_perf(perf: dict, role: str, fmt: str) -> float:
    """Dispatch to the correct fantasy scorer for the format."""
    if fmt == "HUN":
        return compute_fantasy_points_hundred(perf, role)
    if fmt == "ODI":
        return compute_fantasy_points_odi(perf, role)
    return compute_fantasy_points(perf, role)


# ==================== CRICSHEET JSON PARSER ====================

def detect_format(match_info: dict) -> str:
    """Detect match format from Cricsheet info."""
    mt = match_info.get("match_type", "").upper()
    event = match_info.get("event", {}).get("name", "").lower()

    # WPL (women's IPL) — keep distinct from women's T20Is and men's IPL.
    if "women's premier league" in event or event.strip() == "wpl":
        return "WPL"
    # MLC (USA franchise league) — its own bucket, like IPL.
    if "major league cricket" in event or event.strip() == "mlc":
        return "MLC"
    # LPL (Sri Lanka franchise league) — its own bucket, like IPL/MLC.
    if "lanka premier league" in event or event.strip() == "lpl":
        return "LPL"
    if "indian premier league" in event or "ipl" in event:
        return "IPL"
    # The Hundred (100-ball, ECB) — its own bucket. cricsheet tags it match_type="T20",
    # so this MUST come before the T20 branch or Hundred games pollute the T20 pool.
    if "hundred" in event:
        return "HUN"
    if mt in ("T20", "T20I"):
        return "T20I" if mt == "T20I" else "T20"
    if mt == "ODI":
        return "ODI"
    if mt == "TEST":
        return "TEST"
    # Default to T20 for anything in t20s folder
    return "T20"


def parse_match(filepath: str) -> dict:
    """
    Parse a single Cricsheet JSON match file.
    Returns match metadata + per-player performance stats.
    """
    with open(filepath, "r") as f:
        data = json.load(f)

    info = data.get("info", {})
    innings_data = data.get("innings", [])

    match_id = os.path.splitext(os.path.basename(filepath))[0]
    dates = info.get("dates", [])
    match_date = dates[0] if dates else ""
    venue = info.get("venue", "")
    city = info.get("city", "")
    teams = info.get("teams", [])
    registry = info.get("registry", {}).get("people", {})
    match_format = detect_format(info)
    gender = info.get("gender", None)  # "male" or "female"

    # Player performances
    perfs = defaultdict(lambda: {
        "bat_runs": 0, "bat_balls": 0, "bat_4s": 0, "bat_6s": 0,
        "bat_dismissed": False, "dismissal_type": None,
        "bowl_balls": 0, "bowl_runs": 0, "bowl_wickets": 0,
        "bowl_maidens": 0, "bowl_dots": 0, "bowl_lbw_bowled": 0,
        "catches": 0, "stumpings": 0, "run_outs": 0, "direct_run_outs": 0,
        "team": None,
    })

    # Track which team each player belongs to
    players_per_team = info.get("players", {})
    for team_name, player_list in players_per_team.items():
        for pname in player_list:
            perfs[pname]["team"] = team_name

    for innings in innings_data:
        if innings.get("super_over"):
            continue  # super-over deliveries score no fantasy points
        team_batting = innings.get("team", "")
        team_bowling = [t for t in teams if t != team_batting]
        team_bowling = team_bowling[0] if team_bowling else ""

        overs = innings.get("overs", [])
        for over_data in overs:
            over_num = over_data.get("over", 0)
            deliveries = over_data.get("deliveries", [])

            # Track maiden: 0 runs off the bat + no extras that count against bowler
            over_runs_for_maiden = 0
            over_legal_balls = 0
            over_bowler = None

            for delivery in deliveries:
                batter = delivery.get("batter", "")
                bowler = delivery.get("bowler", "")
                runs_batter = delivery.get("runs", {}).get("batter", 0)
                runs_extras = delivery.get("runs", {}).get("extras", 0)
                runs_total = delivery.get("runs", {}).get("total", 0)
                extras = delivery.get("extras", {})

                if over_bowler is None:
                    over_bowler = bowler

                # Is this a legal delivery? (not wide, not no-ball for ball count)
                is_wide = "wides" in extras
                is_noball = "noballs" in extras
                is_legal = not is_wide and not is_noball

                # Batting stats (count all deliveries faced except wides)
                if not is_wide:
                    perfs[batter]["bat_balls"] += 1

                perfs[batter]["bat_runs"] += runs_batter
                if runs_batter == 4:
                    perfs[batter]["bat_4s"] += 1
                elif runs_batter == 6:
                    perfs[batter]["bat_6s"] += 1

                # Bowling stats — runs CHARGED TO THE BOWLER exclude byes/leg-byes (keeper's
                # leak, not the bowler's). Drives economy, maidens and dots. Wides/no-balls count.
                bcharged = runs_total - (extras.get("byes", 0) or 0) - (extras.get("legbyes", 0) or 0)
                perfs[bowler]["bowl_runs"] += bcharged
                if is_legal:
                    perfs[bowler]["bowl_balls"] += 1
                    over_legal_balls += 1

                # Dot ball: legal delivery with 0 runs charged to the bowler
                if is_legal and bcharged == 0:
                    perfs[bowler]["bowl_dots"] += 1

                # For maiden tracking (byes/leg-byes don't break a maiden)
                if is_legal:
                    over_runs_for_maiden += bcharged

                # Wickets
                wickets = delivery.get("wickets", [])
                for w in wickets:
                    kind = w.get("kind", "")
                    player_out = w.get("player_out", "")
                    fielders = w.get("fielders", [])

                    # Mark batter dismissed
                    perfs[player_out]["bat_dismissed"] = True
                    perfs[player_out]["dismissal_type"] = kind

                    # Bowler gets wicket (except run out, retired, obstructing)
                    if kind not in ("run out", "retired hurt", "retired not out",
                                     "retired out", "obstructing the field", "hit wicket"):
                        perfs[bowler]["bowl_wickets"] += 1
                        if kind in ("bowled", "lbw"):
                            perfs[bowler]["bowl_lbw_bowled"] += 1

                    # Hit wicket counts as bowler wicket but not lbw/bowled bonus
                    if kind == "hit wicket":
                        perfs[bowler]["bowl_wickets"] += 1

                    # Fielding: catches
                    if kind == "caught":
                        for fielder_info in fielders:
                            fname = fielder_info.get("name", "")
                            if fname and fname != bowler:
                                perfs[fname]["catches"] += 1
                    if kind == "caught and bowled":   # the bowler caught it — credit the catch
                        perfs[bowler]["catches"] += 1

                    # Fielding: stumped
                    if kind == "stumped":
                        for fielder_info in fielders:
                            fname = fielder_info.get("name", "")
                            if fname:
                                perfs[fname]["stumpings"] += 1

                    # Fielding: run out
                    if kind == "run out":
                        for i, fielder_info in enumerate(fielders):
                            fname = fielder_info.get("name", "")
                            if fname:
                                perfs[fname]["run_outs"] += 1
                                # First fielder in list with single fielder = direct hit
                                if len(fielders) == 1:
                                    perfs[fname]["direct_run_outs"] += 1

            # Check for maiden over (6 legal balls, 0 runs)
            if over_legal_balls == 6 and over_runs_for_maiden == 0 and over_bowler:
                perfs[over_bowler]["bowl_maidens"] += 1

    # Build result
    result = {
        "match_id": match_id,
        "match_date": match_date,
        "venue": venue,
        "city": city,
        "teams": teams,
        "format": match_format,
        "gender": gender,
        "series": (info.get("event", {}).get("name") or "").strip() or None,
        "registry": registry,
        "performances": {},
    }

    for pname, perf in perfs.items():
        if perf["team"] is None:
            continue  # Skip unknown players (fielding sub appearances without team)

        opposition = [t for t in teams if t != perf["team"]]
        opposition = opposition[0] if opposition else ""

        # Get cricsheet ID from registry
        cricsheet_id = None
        if pname in registry:
            ids = registry[pname]
            if isinstance(ids, dict):
                cricsheet_id = ids.get("unique_name") or ids.get("identifier")
            elif isinstance(ids, str):
                cricsheet_id = ids

        result["performances"][pname] = {
            **perf,
            "opposition": opposition,
            "cricsheet_id": cricsheet_id,
        }

    return result


# ==================== DATABASE OPERATIONS ====================

def init_db(conn: sqlite3.Connection):
    """Verify tables exist (created by Drizzle, we just check)."""
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    required = {"players", "match_performances", "career_stats", "venues",
                "player_venue_stats", "player_opposition_stats"}
    missing = required - tables
    if missing:
        print(f"ERROR: Missing tables: {missing}")
        print("Run `npx drizzle-kit push` first to create the schema.")
        sys.exit(1)


def get_or_create_player(conn: sqlite3.Connection, name: str, cricsheet_id: str,
                          country: str = "Unknown") -> int:
    """Get player ID or create new player."""
    if cricsheet_id:
        row = conn.execute(
            "SELECT id FROM players WHERE cricsheet_id = ?", (cricsheet_id,)
        ).fetchone()
        if row:
            return row[0]

    # Try by name
    row = conn.execute(
        "SELECT id FROM players WHERE name = ? AND country = ?", (name, country)
    ).fetchone()
    if row:
        # Update cricsheet_id if we have it now
        if cricsheet_id:
            conn.execute(
                "UPDATE players SET cricsheet_id = ? WHERE id = ?",
                (cricsheet_id, row[0])
            )
        return row[0]

    # Create new player
    cursor = conn.execute(
        "INSERT INTO players (name, cricsheet_id, country, role) VALUES (?, ?, ?, ?)",
        (name, cricsheet_id, country, "BAT")  # Default role, will be updated later
    )
    return cursor.lastrowid


def get_or_create_venue(conn: sqlite3.Connection, name: str, city: str,
                         country: str = None) -> int:
    """Get venue ID or create new venue."""
    row = conn.execute(
        "SELECT id FROM venues WHERE name = ? AND city = ?", (name, city)
    ).fetchone()
    if row:
        return row[0]

    cursor = conn.execute(
        "INSERT INTO venues (name, city, country) VALUES (?, ?, ?)",
        (name, city, country)
    )
    return cursor.lastrowid


def detect_country(team_name: str) -> str:
    """Map team name to country for international matches."""
    COUNTRY_MAP = {
        "India": "India", "Australia": "Australia", "England": "England",
        "Pakistan": "Pakistan", "South Africa": "South Africa",
        "New Zealand": "New Zealand", "Sri Lanka": "Sri Lanka",
        "West Indies": "West Indies", "Bangladesh": "Bangladesh",
        "Afghanistan": "Afghanistan", "Zimbabwe": "Zimbabwe",
        "Ireland": "Ireland", "Scotland": "Scotland", "Netherlands": "Netherlands",
        "Nepal": "Nepal", "Namibia": "Namibia", "Oman": "Oman",
        "United States of America": "USA", "U.S.A.": "USA", "USA": "USA",
        "Papua New Guinea": "Papua New Guinea", "Canada": "Canada",
        "United Arab Emirates": "UAE", "U.A.E.": "UAE",
        "Hong Kong": "Hong Kong",
    }
    return COUNTRY_MAP.get(team_name, "Unknown")


# IPL team → country mapping for IPL players
IPL_OVERSEAS = {
    # Known overseas players will be detected from international data
    # For now, we rely on the registry + manual seeding
}


def infer_role(perfs: list) -> str:
    """
    Infer player role from their match performances.
    perfs: list of dicts with bat_runs, bat_balls, bowl_balls, bowl_wickets, stumpings, catches
    """
    total_bat_balls = sum(p.get("bat_balls", 0) or 0 for p in perfs)
    total_bowl_balls = sum(p.get("bowl_balls", 0) or 0 for p in perfs)
    total_stumpings = sum(p.get("stumpings", 0) or 0 for p in perfs)
    matches = len(perfs)

    if matches == 0:
        return "BAT"

    avg_bat_balls = total_bat_balls / matches
    avg_bowl_balls = total_bowl_balls / matches

    # Wicketkeeper: has stumpings
    if total_stumpings >= 2:
        return "WK"

    # All-rounder: bats and bowls significantly
    if avg_bat_balls >= 8 and avg_bowl_balls >= 12:
        return "AR"

    # Bowler: bowls a lot, doesn't bat much
    if avg_bowl_balls >= 18 and avg_bat_balls < 12:
        return "BOWL"

    # Pure batter
    if avg_bat_balls >= 10 and avg_bowl_balls < 6:
        return "BAT"

    # Default: if they bowl more than bat, they're a bowler
    if avg_bowl_balls > avg_bat_balls:
        return "BOWL"

    return "BAT"


def process_all_matches(conn: sqlite3.Connection):
    """Process all downloaded Cricsheet JSON matches."""

    # Gather all JSON files
    json_files = []
    for folder in ["ipl", "t20i", "wpl", "mlc", "hundred", "odi", "lpl", "bbl", "blast", "psl", "sa20", "ilt20", "cpl", "wbbl"]:
        folder_path = os.path.join(RAW_DIR, folder)
        if os.path.isdir(folder_path):
            files = glob.glob(os.path.join(folder_path, "*.json"))
            json_files.extend(files)

    if not json_files:
        print("ERROR: No JSON files found. Run download_cricsheet.py first.")
        sys.exit(1)

    print(f"Found {len(json_files)} match files to process.")

    # Check for already processed matches
    existing = set()
    for row in conn.execute("SELECT match_id FROM match_performances").fetchall():
        existing.add(row[0])

    # Track per-player performances for role inference
    player_perfs = defaultdict(list)
    player_countries = {}

    processed = 0
    skipped = 0
    errors = 0

    for i, filepath in enumerate(json_files):
        match_id = os.path.splitext(os.path.basename(filepath))[0]

        if match_id in existing:
            skipped += 1
            continue

        try:
            match = parse_match(filepath)
            _folder = os.path.basename(os.path.dirname(filepath))
            if _folder in FOLDER_FORMAT:
                match["format"] = FOLDER_FORMAT[_folder]  # franchise league: folder-driven format
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error parsing {filepath}: {e}")
            continue

        venue_id = None
        if match["venue"]:
            venue_id = get_or_create_venue(conn, match["venue"], match["city"])

        for pname, perf in match["performances"].items():
            # Determine country
            team = perf["team"]
            country = detect_country(team)
            if country == "Unknown" and match["format"] == "IPL":
                # For IPL, we'll try to get from previous data
                country = player_countries.get(pname, "Unknown")

            if country != "Unknown":
                player_countries[pname] = country

            player_id = get_or_create_player(
                conn, pname, perf.get("cricsheet_id"), country
            )

            # Update gender if available
            if match["gender"]:
                conn.execute(
                    "UPDATE players SET gender = ? WHERE id = ? AND gender IS NULL",
                    (match["gender"], player_id)
                )

            # Compute fantasy points
            # Need role — use "BAT" for now, will recompute after role inference
            fantasy_pts = score_perf(perf, "BAT", match["format"])

            # Insert match performance
            conn.execute("""
                INSERT INTO match_performances (
                    player_id, match_id, match_date, format, venue_id, venue_name, opposition,
                    bat_runs, bat_balls, bat_4s, bat_6s, bat_dismissed, dismissal_type,
                    bowl_balls, bowl_runs, bowl_wickets, bowl_maidens, bowl_dots, bowl_lbw_bowled,
                    catches, stumpings, run_outs, direct_run_outs, fantasy_points, series
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                player_id, match["match_id"], match["match_date"], match["format"],
                venue_id, match["venue"], perf["opposition"],
                perf["bat_runs"], perf["bat_balls"], perf["bat_4s"], perf["bat_6s"],
                1 if perf["bat_dismissed"] else 0, perf["dismissal_type"],
                perf["bowl_balls"], perf["bowl_runs"], perf["bowl_wickets"],
                perf["bowl_maidens"], perf["bowl_dots"], perf["bowl_lbw_bowled"],
                perf["catches"], perf["stumpings"], perf["run_outs"],
                perf["direct_run_outs"], fantasy_pts, match.get("series"),
            ))

            # Track for role inference
            player_perfs[player_id].append(perf)

        processed += 1

        if (i + 1) % 500 == 0:
            conn.commit()
            print(f"  Processed {i + 1}/{len(json_files)} files ({processed} new, {skipped} skipped)...")

    conn.commit()
    print(f"\nMatch processing complete: {processed} new, {skipped} skipped, {errors} errors.")

    return player_perfs


def update_player_roles(conn: sqlite3.Connection, player_perfs: dict):
    """Infer and update player roles based on their performance data."""
    print("Updating player roles...")

    # Also get from DB for players already processed
    cursor = conn.execute("""
        SELECT player_id,
               AVG(bat_balls) as avg_bat_balls,
               AVG(bowl_balls) as avg_bowl_balls,
               SUM(stumpings) as total_stumpings,
               COUNT(*) as matches
        FROM match_performances
        GROUP BY player_id
    """)

    updated = 0
    for row in cursor.fetchall():
        pid, avg_bat, avg_bowl, stumpings, matches = row
        avg_bat = avg_bat or 0
        avg_bowl = avg_bowl or 0
        stumpings = stumpings or 0

        if matches < 3:
            continue

        if stumpings >= 2:
            role = "WK"
        elif avg_bat >= 8 and avg_bowl >= 12:
            role = "AR"
        elif avg_bowl >= 18 and avg_bat < 12:
            role = "BOWL"
        elif avg_bat >= 10 and avg_bowl < 6:
            role = "BAT"
        elif avg_bowl > avg_bat:
            role = "BOWL"
        else:
            role = "BAT"

        conn.execute("UPDATE players SET role = ? WHERE id = ?", (role, pid))
        updated += 1

    conn.commit()
    print(f"  Updated roles for {updated} players.")


def recompute_fantasy_points_with_roles(conn: sqlite3.Connection):
    """Recompute fantasy points now that we have correct roles."""
    print("Recomputing fantasy points with correct roles...")

    cursor = conn.execute("""
        SELECT mp.id, mp.bat_runs, mp.bat_balls, mp.bat_4s, mp.bat_6s,
               mp.bat_dismissed, mp.dismissal_type,
               mp.bowl_balls, mp.bowl_runs, mp.bowl_wickets, mp.bowl_maidens,
               mp.bowl_dots, mp.bowl_lbw_bowled,
               mp.catches, mp.stumpings, mp.run_outs, mp.direct_run_outs,
               p.role, mp.format
        FROM match_performances mp
        JOIN players p ON mp.player_id = p.id
    """)

    batch = []
    count = 0
    for row in cursor.fetchall():
        perf = {
            "bat_runs": row[1], "bat_balls": row[2], "bat_4s": row[3], "bat_6s": row[4],
            "bat_dismissed": bool(row[5]), "dismissal_type": row[6],
            "bowl_balls": row[7], "bowl_runs": row[8], "bowl_wickets": row[9],
            "bowl_maidens": row[10], "bowl_dots": row[11], "bowl_lbw_bowled": row[12],
            "catches": row[13], "stumpings": row[14], "run_outs": row[15],
            "direct_run_outs": row[16],
        }
        role = row[17] or "BAT"
        fmt = row[18] or "T20"
        fps = score_perf(perf, role, fmt)
        batch.append((fps, row[0]))
        count += 1

        if len(batch) >= 5000:
            conn.executemany("UPDATE match_performances SET fantasy_points = ? WHERE id = ?", batch)
            batch = []

    if batch:
        conn.executemany("UPDATE match_performances SET fantasy_points = ? WHERE id = ?", batch)

    conn.commit()
    print(f"  Recomputed fantasy points for {count} performances.")


def compute_career_stats(conn: sqlite3.Connection):
    """Compute career stats per player × format from match performances."""
    print("Computing career stats...")

    # Clear existing
    conn.execute("DELETE FROM career_stats")

    conn.execute("""
        INSERT INTO career_stats (
            player_id, format,
            bat_matches, bat_innings, bat_runs, bat_avg, bat_sr,
            bat_50s, bat_100s, bat_hs, bat_4s, bat_6s,
            bowl_innings, bowl_wickets, bowl_avg, bowl_econ, bowl_sr, bowl_best,
            bowl_4w, bowl_5w,
            catches, stumpings,
            avg_fantasy_points, total_fantasy_points
        )
        SELECT
            player_id,
            format,
            COUNT(*) as bat_matches,
            SUM(CASE WHEN bat_balls > 0 THEN 1 ELSE 0 END) as bat_innings,
            SUM(COALESCE(bat_runs, 0)) as bat_runs,
            CASE
                WHEN SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END) > 0
                THEN ROUND(CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END), 2)
                ELSE 0
            END as bat_avg,
            CASE
                WHEN SUM(COALESCE(bat_balls, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(COALESCE(bat_balls, 0)) * 100, 2)
                ELSE 0
            END as bat_sr,
            SUM(CASE WHEN bat_runs >= 50 AND bat_runs < 100 THEN 1 ELSE 0 END) as bat_50s,
            SUM(CASE WHEN bat_runs >= 100 THEN 1 ELSE 0 END) as bat_100s,
            MAX(COALESCE(bat_runs, 0)) as bat_hs,
            SUM(COALESCE(bat_4s, 0)) as bat_4s,
            SUM(COALESCE(bat_6s, 0)) as bat_6s,
            SUM(CASE WHEN bowl_balls > 0 THEN 1 ELSE 0 END) as bowl_innings,
            SUM(COALESCE(bowl_wickets, 0)) as bowl_wickets,
            CASE
                WHEN SUM(COALESCE(bowl_wickets, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / SUM(COALESCE(bowl_wickets, 0)), 2)
                ELSE 0
            END as bowl_avg,
            CASE
                WHEN SUM(COALESCE(bowl_balls, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / (SUM(COALESCE(bowl_balls, 0)) / 6.0), 2)
                ELSE 0
            END as bowl_econ,
            CASE
                WHEN SUM(COALESCE(bowl_wickets, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_balls, 0)) AS REAL) / SUM(COALESCE(bowl_wickets, 0)), 2)
                ELSE 0
            END as bowl_sr,
            MAX(COALESCE(bowl_wickets, 0)) as bowl_best,
            SUM(CASE WHEN bowl_wickets >= 4 AND bowl_wickets < 5 THEN 1 ELSE 0 END) as bowl_4w,
            SUM(CASE WHEN bowl_wickets >= 5 THEN 1 ELSE 0 END) as bowl_5w,
            SUM(COALESCE(catches, 0)) as catches,
            SUM(COALESCE(stumpings, 0)) as stumpings,
            ROUND(AVG(COALESCE(fantasy_points, 0)), 2) as avg_fantasy_points,
            ROUND(SUM(COALESCE(fantasy_points, 0)), 2) as total_fantasy_points
        FROM match_performances
        GROUP BY player_id, format
    """)

    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM career_stats").fetchone()[0]
    print(f"  Computed career stats: {count} player×format combinations.")


def compute_venue_stats(conn: sqlite3.Connection):
    """Compute player × venue aggregated stats."""
    print("Computing player venue stats...")

    conn.execute("DELETE FROM player_venue_stats")

    conn.execute("""
        INSERT INTO player_venue_stats (
            player_id, venue_id, matches,
            bat_runs, bat_avg, bat_sr,
            bowl_wickets, bowl_avg, bowl_econ,
            avg_fantasy_points
        )
        SELECT
            player_id,
            venue_id,
            COUNT(*) as matches,
            SUM(COALESCE(bat_runs, 0)),
            CASE
                WHEN SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END) > 0
                THEN ROUND(CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END), 2)
                ELSE 0
            END,
            CASE
                WHEN SUM(COALESCE(bat_balls, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(COALESCE(bat_balls, 0)) * 100, 2)
                ELSE 0
            END,
            SUM(COALESCE(bowl_wickets, 0)),
            CASE
                WHEN SUM(COALESCE(bowl_wickets, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / SUM(COALESCE(bowl_wickets, 0)), 2)
                ELSE 0
            END,
            CASE
                WHEN SUM(COALESCE(bowl_balls, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / (SUM(COALESCE(bowl_balls, 0)) / 6.0), 2)
                ELSE 0
            END,
            ROUND(AVG(COALESCE(fantasy_points, 0)), 2)
        FROM match_performances
        WHERE venue_id IS NOT NULL
        GROUP BY player_id, venue_id
    """)

    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM player_venue_stats").fetchone()[0]
    print(f"  Computed venue stats: {count} player×venue combinations.")


def compute_opposition_stats(conn: sqlite3.Connection):
    """Compute player × opposition aggregated stats."""
    print("Computing player opposition stats...")

    conn.execute("DELETE FROM player_opposition_stats")

    conn.execute("""
        INSERT INTO player_opposition_stats (
            player_id, opposition, format, matches,
            bat_runs, bat_avg, bat_sr,
            bowl_wickets, bowl_avg, bowl_econ,
            avg_fantasy_points
        )
        SELECT
            player_id,
            opposition,
            format,
            COUNT(*) as matches,
            SUM(COALESCE(bat_runs, 0)),
            CASE
                WHEN SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END) > 0
                THEN ROUND(CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(CASE WHEN bat_dismissed = 1 THEN 1 ELSE 0 END), 2)
                ELSE 0
            END,
            CASE
                WHEN SUM(COALESCE(bat_balls, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bat_runs, 0)) AS REAL) / SUM(COALESCE(bat_balls, 0)) * 100, 2)
                ELSE 0
            END,
            SUM(COALESCE(bowl_wickets, 0)),
            CASE
                WHEN SUM(COALESCE(bowl_wickets, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / SUM(COALESCE(bowl_wickets, 0)), 2)
                ELSE 0
            END,
            CASE
                WHEN SUM(COALESCE(bowl_balls, 0)) > 0
                THEN ROUND(CAST(SUM(COALESCE(bowl_runs, 0)) AS REAL) / (SUM(COALESCE(bowl_balls, 0)) / 6.0), 2)
                ELSE 0
            END,
            ROUND(AVG(COALESCE(fantasy_points, 0)), 2)
        FROM match_performances
        GROUP BY player_id, opposition, format
    """)

    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM player_opposition_stats").fetchone()[0]
    print(f"  Computed opposition stats: {count} player×opposition×format combinations.")


def print_top_players(conn: sqlite3.Connection):
    """Print top players by EFPPM for verification."""
    print("\n==================== TOP 20 PLAYERS BY EFPPM (IPL + T20I) ====================")
    cursor = conn.execute("""
        SELECT p.name, p.role, p.country, cs.format,
               cs.bat_matches, cs.avg_fantasy_points, cs.bat_avg, cs.bat_sr,
               cs.bowl_wickets, cs.bowl_econ
        FROM career_stats cs
        JOIN players p ON cs.player_id = p.id
        WHERE cs.format IN ('IPL', 'T20I')
          AND cs.bat_matches >= 20
        ORDER BY cs.avg_fantasy_points DESC
        LIMIT 20
    """)

    print(f"{'Name':<25} {'Role':<5} {'Country':<15} {'Format':<6} {'Mat':<5} {'EFPPM':<8} {'BatAvg':<8} {'BatSR':<8} {'Wkts':<6} {'Econ':<6}")
    print("-" * 110)
    for row in cursor.fetchall():
        print(f"{row[0]:<25} {row[1]:<5} {row[2]:<15} {row[3]:<6} {row[4]:<5} {row[5]:<8.1f} {row[6]:<8.1f} {row[7]:<8.1f} {row[8]:<6} {row[9]:<6.1f}")


def main():
    print("=" * 60)
    print("Cricket Auction Helper — ETL Pipeline")
    print("=" * 60)

    # Ensure DB directory exists
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    init_db(conn)

    # Step 1: Process all matches
    player_perfs = process_all_matches(conn)

    # Step 2: Infer and update player roles
    update_player_roles(conn, player_perfs)

    # Step 3: Recompute fantasy points with correct roles
    recompute_fantasy_points_with_roles(conn)

    # Step 4: Compute aggregated stats
    compute_career_stats(conn)
    compute_venue_stats(conn)
    compute_opposition_stats(conn)

    # Step 5: Print verification
    print_top_players(conn)

    # Summary stats
    player_count = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    match_count = conn.execute("SELECT COUNT(DISTINCT match_id) FROM match_performances").fetchone()[0]
    perf_count = conn.execute("SELECT COUNT(*) FROM match_performances").fetchone()[0]
    venue_count = conn.execute("SELECT COUNT(*) FROM venues").fetchone()[0]

    print(f"\n{'=' * 60}")
    print(f"ETL Complete!")
    print(f"  Players: {player_count}")
    print(f"  Matches: {match_count}")
    print(f"  Performance records: {perf_count}")
    print(f"  Venues: {venue_count}")
    print(f"{'=' * 60}")

    conn.close()


if __name__ == "__main__":
    main()
