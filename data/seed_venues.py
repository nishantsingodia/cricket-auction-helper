#!/usr/bin/env python3
"""
Seed venue pitch characteristics for major cricket grounds.
Updates venues created during ETL with manual pitch data.
"""

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "db", "cricket-auction.db")

# Major venues with pitch characteristics
# pitch_type: PACE | SPIN | BALANCED
# bounce/turn/swing ratings: 1-5
VENUE_DATA = [
    # Indian Venues
    {"name": "Wankhede Stadium", "city": "Mumbai", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 2},
    {"name": "M Chinnaswamy Stadium", "city": "Bengaluru", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 2},
    {"name": "Eden Gardens", "city": "Kolkata", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 3},
    {"name": "MA Chidambaram Stadium", "city": "Chennai", "country": "India", "pitch_type": "SPIN", "bounce": 2, "turn": 5, "swing": 2},
    {"name": "MA Chidambaram Stadium, Chepauk", "city": "Chennai", "country": "India", "pitch_type": "SPIN", "bounce": 2, "turn": 5, "swing": 2},
    {"name": "Arun Jaitley Stadium", "city": "Delhi", "country": "India", "pitch_type": "SPIN", "bounce": 2, "turn": 4, "swing": 3},
    {"name": "Arun Jaitley Stadium, Delhi", "city": "Delhi", "country": "India", "pitch_type": "SPIN", "bounce": 2, "turn": 4, "swing": 3},
    {"name": "Punjab Cricket Association IS Bindra Stadium", "city": "Mohali", "country": "India", "pitch_type": "PACE", "bounce": 3, "turn": 2, "swing": 4},
    {"name": "Rajiv Gandhi International Stadium", "city": "Hyderabad", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 2},
    {"name": "Narendra Modi Stadium", "city": "Ahmedabad", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 2},
    {"name": "Sawai Mansingh Stadium", "city": "Jaipur", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 2},
    {"name": "Dr DY Patil Sports Academy", "city": "Navi Mumbai", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 2},
    {"name": "Brabourne Stadium", "city": "Mumbai", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 2},
    {"name": "Himachal Pradesh Cricket Association Stadium", "city": "Dharamsala", "country": "India", "pitch_type": "PACE", "bounce": 3, "turn": 2, "swing": 4},
    {"name": "Ekana Cricket Stadium", "city": "Lucknow", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 2},
    {"name": "Maharashtra Cricket Association Stadium", "city": "Pune", "country": "India", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 3},

    # International Venues
    {"name": "Melbourne Cricket Ground", "city": "Melbourne", "country": "Australia", "pitch_type": "PACE", "bounce": 5, "turn": 2, "swing": 3},
    {"name": "Sydney Cricket Ground", "city": "Sydney", "country": "Australia", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 3},
    {"name": "Brisbane Cricket Ground, Woolloongabba", "city": "Brisbane", "country": "Australia", "pitch_type": "PACE", "bounce": 5, "turn": 1, "swing": 3},
    {"name": "Perth Stadium", "city": "Perth", "country": "Australia", "pitch_type": "PACE", "bounce": 5, "turn": 1, "swing": 2},
    {"name": "Lord's", "city": "London", "country": "England", "pitch_type": "PACE", "bounce": 3, "turn": 2, "swing": 5},
    {"name": "The Oval", "city": "London", "country": "England", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 4},
    {"name": "Wanderers Stadium", "city": "Johannesburg", "country": "South Africa", "pitch_type": "PACE", "bounce": 5, "turn": 1, "swing": 3},
    {"name": "Newlands", "city": "Cape Town", "country": "South Africa", "pitch_type": "PACE", "bounce": 4, "turn": 2, "swing": 4},
    {"name": "Galle International Stadium", "city": "Galle", "country": "Sri Lanka", "pitch_type": "SPIN", "bounce": 2, "turn": 5, "swing": 2},
    {"name": "Dubai International Cricket Stadium", "city": "Dubai", "country": "UAE", "pitch_type": "BALANCED", "bounce": 3, "turn": 3, "swing": 2},
    {"name": "Sharjah Cricket Stadium", "city": "Sharjah", "country": "UAE", "pitch_type": "SPIN", "bounce": 2, "turn": 4, "swing": 1},
    {"name": "Adelaide Oval", "city": "Adelaide", "country": "Australia", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 4},
    {"name": "Trent Bridge", "city": "Nottingham", "country": "England", "pitch_type": "PACE", "bounce": 3, "turn": 2, "swing": 5},
    {"name": "Edgbaston", "city": "Birmingham", "country": "England", "pitch_type": "BALANCED", "bounce": 3, "turn": 2, "swing": 4},
    {"name": "Basin Reserve", "city": "Wellington", "country": "New Zealand", "pitch_type": "PACE", "bounce": 3, "turn": 2, "swing": 5},
    {"name": "Hagley Oval", "city": "Christchurch", "country": "New Zealand", "pitch_type": "PACE", "bounce": 3, "turn": 2, "swing": 4},
]


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON")

    updated = 0
    created = 0

    for v in VENUE_DATA:
        # Try to find existing venue (created during ETL)
        # Match by partial name since Cricsheet venue names can vary
        row = conn.execute(
            "SELECT id FROM venues WHERE name LIKE ? OR (city = ? AND country = ?)",
            (f"%{v['name']}%", v.get("city"), v.get("country"))
        ).fetchone()

        if row:
            conn.execute("""
                UPDATE venues SET
                    pitch_type = ?, bounce_rating = ?, turn_rating = ?, swing_rating = ?,
                    country = ?
                WHERE id = ?
            """, (v["pitch_type"], v["bounce"], v["turn"], v["swing"], v["country"], row[0]))
            updated += 1
        else:
            conn.execute("""
                INSERT OR IGNORE INTO venues (name, city, country, pitch_type, bounce_rating, turn_rating, swing_rating)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (v["name"], v["city"], v["country"], v["pitch_type"], v["bounce"], v["turn"], v["swing"]))
            created += 1

    # Compute average scores from match data for all venues
    conn.execute("""
        UPDATE venues SET
            avg_first_innings_score = (
                SELECT ROUND(AVG(total_runs), 1)
                FROM (
                    SELECT mp.venue_id, mp.match_id,
                           SUM(mp.bat_runs) as total_runs,
                           ROW_NUMBER() OVER (PARTITION BY mp.match_id ORDER BY MIN(mp.id)) as innings_num
                    FROM match_performances mp
                    WHERE mp.venue_id = venues.id
                    GROUP BY mp.match_id, mp.opposition
                ) sub
                WHERE innings_num = 1
            ),
            avg_run_rate = (
                SELECT ROUND(AVG(COALESCE(fantasy_points, 0)), 1)
                FROM match_performances
                WHERE venue_id = venues.id
            )
    """)

    conn.commit()

    total_venues = conn.execute("SELECT COUNT(*) FROM venues").fetchone()[0]
    venues_with_pitch = conn.execute("SELECT COUNT(*) FROM venues WHERE pitch_type IS NOT NULL").fetchone()[0]

    print(f"Venue seeding complete:")
    print(f"  Updated: {updated}")
    print(f"  Created: {created}")
    print(f"  Total venues: {total_venues}")
    print(f"  Venues with pitch data: {venues_with_pitch}")

    conn.close()


if __name__ == "__main__":
    main()
