import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// ==================== PLAYER DATA TABLES ====================

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cricsheetId: text("cricsheet_id").unique(),
  cricinfoId: text("cricinfo_id"),
  name: text("name").notNull(),
  fullName: text("full_name"),
  country: text("country").notNull(),
  dob: text("dob"), // ISO date
  role: text("role", { enum: ["BAT", "BOWL", "AR", "WK"] }).notNull(),
  batStyle: text("bat_style"), // RHB, LHB
  bowlStyle: text("bowl_style"), // RF, RMF, RM, OB, SLA, LBG, SLO, LF, LMF, LM
  isOverseas: integer("is_overseas", { mode: "boolean" }).default(false),
  gender: text("gender"), // "male" or "female" from cricsheet
  profileUrl: text("profile_url"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const careerStats = sqliteTable(
  "career_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    format: text("format", {
      enum: ["TEST", "ODI", "T20I", "IPL", "T20"],
    }).notNull(),
    // Batting
    batMatches: integer("bat_matches").default(0),
    batInnings: integer("bat_innings").default(0),
    batRuns: integer("bat_runs").default(0),
    batAvg: real("bat_avg").default(0),
    batSr: real("bat_sr").default(0),
    bat50s: integer("bat_50s").default(0),
    bat100s: integer("bat_100s").default(0),
    batHs: text("bat_hs"),
    bat4s: integer("bat_4s").default(0),
    bat6s: integer("bat_6s").default(0),
    // Bowling
    bowlInnings: integer("bowl_innings").default(0),
    bowlWickets: integer("bowl_wickets").default(0),
    bowlAvg: real("bowl_avg").default(0),
    bowlEcon: real("bowl_econ").default(0),
    bowlSr: real("bowl_sr").default(0),
    bowlBest: text("bowl_best"),
    bowl4w: integer("bowl_4w").default(0),
    bowl5w: integer("bowl_5w").default(0),
    // Fielding
    catches: integer("catches").default(0),
    stumpings: integer("stumpings").default(0),
    // Fantasy
    avgFantasyPoints: real("avg_fantasy_points").default(0),
    totalFantasyPoints: real("total_fantasy_points").default(0),
    // Meta
    lastUpdated: text("last_updated").default("(datetime('now'))"),
  },
  (table) => [
    uniqueIndex("career_stats_player_format").on(
      table.playerId,
      table.format
    ),
  ]
);

export const matchPerformances = sqliteTable("match_performances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  matchId: text("match_id").notNull(),
  matchDate: text("match_date").notNull(),
  format: text("format").notNull(),
  venueId: integer("venue_id").references(() => venues.id),
  venueName: text("venue_name"),
  opposition: text("opposition").notNull(),
  series: text("series"), // cricsheet event.name — the tour/series (IPL, "India tour of England", ICC T20 WC…); null for a few event-less matches
  // Batting
  batRuns: integer("bat_runs"),
  batBalls: integer("bat_balls"),
  bat4s: integer("bat_4s"),
  bat6s: integer("bat_6s"),
  batDismissed: integer("bat_dismissed", { mode: "boolean" }).default(false),
  dismissalType: text("dismissal_type"), // bowled, lbw, caught, run out, stumped, etc.
  // Bowling
  bowlBalls: integer("bowl_balls"),
  bowlRuns: integer("bowl_runs"),
  bowlWickets: integer("bowl_wickets"),
  bowlMaidens: integer("bowl_maidens"),
  bowlDots: integer("bowl_dots"),
  bowlLbwBowled: integer("bowl_lbw_bowled").default(0), // wickets via LBW or bowled
  // Fielding
  catches: integer("catches").default(0),
  stumpings: integer("stumpings").default(0),
  runOuts: integer("run_outs").default(0),
  directRunOuts: integer("direct_run_outs").default(0),
  // Fantasy Points (computed from Dream11 rules)
  fantasyPoints: real("fantasy_points").default(0),
});

export const venues = sqliteTable(
  "venues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    city: text("city"),
    country: text("country"),
    pitchType: text("pitch_type", {
      enum: ["PACE", "SPIN", "BALANCED"],
    }),
    avgFirstInningsScore: real("avg_first_innings_score"),
    avgSecondInningsScore: real("avg_second_innings_score"),
    avgPaceWicketsPct: real("avg_pace_wickets_pct"),
    avgSpinWicketsPct: real("avg_spin_wickets_pct"),
    avgRunRate: real("avg_run_rate"),
    bounceRating: integer("bounce_rating"), // 1-5
    turnRating: integer("turn_rating"), // 1-5
    swingRating: integer("swing_rating"), // 1-5
  },
  (table) => [uniqueIndex("venues_name_city").on(table.name, table.city)]
);

export const playerVenueStats = sqliteTable(
  "player_venue_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id),
    matches: integer("matches").default(0),
    batRuns: integer("bat_runs").default(0),
    batAvg: real("bat_avg").default(0),
    batSr: real("bat_sr").default(0),
    bowlWickets: integer("bowl_wickets").default(0),
    bowlAvg: real("bowl_avg").default(0),
    bowlEcon: real("bowl_econ").default(0),
    avgFantasyPoints: real("avg_fantasy_points").default(0),
  },
  (table) => [
    uniqueIndex("player_venue_unique").on(table.playerId, table.venueId),
  ]
);

export const playerOppositionStats = sqliteTable(
  "player_opposition_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    opposition: text("opposition").notNull(),
    format: text("format").notNull(),
    matches: integer("matches").default(0),
    batRuns: integer("bat_runs").default(0),
    batAvg: real("bat_avg").default(0),
    batSr: real("bat_sr").default(0),
    bowlWickets: integer("bowl_wickets").default(0),
    bowlAvg: real("bowl_avg").default(0),
    bowlEcon: real("bowl_econ").default(0),
    avgFantasyPoints: real("avg_fantasy_points").default(0),
  },
  (table) => [
    uniqueIndex("player_opp_unique").on(
      table.playerId,
      table.opposition,
      table.format
    ),
  ]
);

// ==================== TOURNAMENT / AUCTION TABLES ====================

export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  format: text("format", {
    enum: ["IPL", "BILATERAL", "CUSTOM"],
  }).notNull(),
  matchFormat: text("match_format", {
    enum: ["T20", "ODI", "TEST"],
  }).notNull(),
  pursePerTeam: real("purse_per_team").notNull(),
  currencyUnit: text("currency_unit").default("Cr"), // Cr, Lakhs, Credits
  maxSquadSize: integer("max_squad_size").notNull(),
  maxOverseas: integer("max_overseas").default(4),
  maxOverseasSquad: integer("max_overseas_squad").default(8),
  numCaptains: integer("num_captains").default(1),
  numViceCaptains: integer("num_vice_captains").default(1),
  status: text("status", {
    enum: ["SETUP", "AUCTION", "ACTIVE", "COMPLETED"],
  }).default("SETUP"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

// ==================== AUCTIONS (friend-based fantasy auction) ====================

export const auctions = sqliteTable("auctions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  tournamentId: integer("tournament_id").references(() => tournaments.id),
  tournamentName: text("tournament_name").notNull().default("IPL 2026"),
  matchFormat: text("match_format").notNull().default("T20"),
  numFriends: integer("num_friends").notNull(),
  pursePerFriend: real("purse_per_friend").notNull(),
  playersPerFriend: integer("players_per_friend").notNull(),
  numCaptains: integer("num_captains").default(1),
  numViceCaptains: integer("num_vice_captains").default(1),
  // House-rule lever (default OFF): movable C/VC armband (in-tournament changes),
  // consumed by the valuation engine's C/VC premium (wider band, lower peak).
  changesAllowed: integer("changes_allowed").default(0),
  status: text("status", {
    enum: ["SETUP", "LIVE", "COMPLETED"],
  }).default("SETUP"),
  createdAt: text("created_at").default("(datetime('now'))"),
});

export const auctionParticipants = sqliteTable(
  "auction_participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    color: text("color"), // hex color
    purse: real("purse").notNull(),
    remainingPurse: real("remaining_purse").notNull(),
    isMe: integer("is_me", { mode: "boolean" }).default(false),
  },
  (table) => [
    uniqueIndex("participant_auction_unique").on(
      table.auctionId,
      table.name
    ),
  ]
);

export const watchlist = sqliteTable(
  "watchlist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    color: text("color"), // optional color tag
    priority: integer("priority").default(0),
    notes: text("notes"),
    createdAt: text("created_at").default("(datetime('now'))"),
  },
  (table) => [
    uniqueIndex("watchlist_auction_player").on(
      table.auctionId,
      table.playerId
    ),
  ]
);

export const tournamentTeams = sqliteTable(
  "tournament_teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    color: text("color"), // hex color
    remainingPurse: real("remaining_purse").notNull(),
    retainedCount: integer("retained_count").default(0),
  },
  (table) => [
    uniqueIndex("team_tournament_unique").on(
      table.tournamentId,
      table.name
    ),
  ]
);

export const auctionPool = sqliteTable(
  "auction_pool",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    basePrice: real("base_price").notNull(),
    status: text("status", {
      enum: ["AVAILABLE", "SOLD", "UNSOLD"],
    }).default("AVAILABLE"),
    soldToTeam: integer("sold_to_team").references(() => tournamentTeams.id),
    soldPrice: real("sold_price"),
    soldAt: text("sold_at"),
    setNumber: integer("set_number"),
    // New: friend-based auction fields
    auctionId: integer("auction_id").references(() => auctions.id),
    soldToParticipant: integer("sold_to_participant").references(() => auctionParticipants.id),
    iplTeam: text("ipl_team"), // real IPL franchise: "CSK", "MI", "SRH", etc.
    squadNumber: integer("squad_number"), // lineup order: 1-12 = Playing XII (Best of 12), 13+ = bench
    // Availability / News
    availability: text("availability", {
      enum: ["FIT", "DOUBTFUL", "INJURED", "UNAVAILABLE"],
    }).default("FIT"),
    newsNotes: text("news_notes"),
    // Cached valuation (recomputed on each sale)
    valFloor: real("val_floor"),
    valExpected: real("val_expected"),
    valCeiling: real("val_ceiling"),
    efppm: real("efppm"), // Expected Fantasy Points Per Match
    bowlOversAvg: real("bowl_overs_avg"), // Avg bowling overs per match (informational)
    priceManual: integer("price_manual").default(0), // 1 if user manually set the price
    riskNote: text("risk_note"), // free-text risk reason (foreign slot clash, injury, bench risk, etc.)
  },
  (table) => [
    uniqueIndex("auction_pool_unique").on(
      table.tournamentId,
      table.playerId
    ),
  ]
);

export const retainedPlayers = sqliteTable(
  "retained_players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => tournamentTeams.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    retentionPrice: real("retention_price").notNull(),
    retentionSlot: integer("retention_slot").notNull(),
  },
  (table) => [
    uniqueIndex("retained_unique").on(table.tournamentId, table.playerId),
  ]
);

export const teamCaptains = sqliteTable("team_captains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  teamId: integer("team_id")
    .notNull()
    .references(() => tournamentTeams.id),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  role: text("role", { enum: ["C", "VC"] }).notNull(),
  matchId: text("match_id"), // null = tournament-wide, set = per-match
});

// ==================== SCORING TABLES ====================

export const matchResults = sqliteTable("match_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  matchId: text("match_id").notNull(),
  matchDate: text("match_date").notNull(),
  venueId: integer("venue_id").references(() => venues.id),
  team1: text("team1").notNull(),
  team2: text("team2").notNull(),
  result: text("result"),
  status: text("status", {
    enum: ["UPCOMING", "LIVE", "COMPLETED"],
  }).default("UPCOMING"),
});

export const matchFantasyScores = sqliteTable("match_fantasy_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchResultId: integer("match_result_id")
    .notNull()
    .references(() => matchResults.id),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  // Raw performance
  batRuns: integer("bat_runs"),
  batBalls: integer("bat_balls"),
  bat4s: integer("bat_4s"),
  bat6s: integer("bat_6s"),
  batDismissed: integer("bat_dismissed", { mode: "boolean" }),
  dismissalType: text("dismissal_type"),
  bowlBalls: integer("bowl_balls"),
  bowlRuns: integer("bowl_runs"),
  bowlWickets: integer("bowl_wickets"),
  bowlMaidens: integer("bowl_maidens"),
  bowlDots: integer("bowl_dots"),
  bowlLbwBowled: integer("bowl_lbw_bowled").default(0),
  catches: integer("catches").default(0),
  stumpings: integer("stumpings").default(0),
  runOuts: integer("run_outs").default(0),
  directRunOuts: integer("direct_run_outs").default(0),
  // Calculated
  fantasyPoints: real("fantasy_points").default(0),
  inStartingXi: integer("in_starting_xi", { mode: "boolean" }).default(true),
});

export const leaderboard = sqliteTable("leaderboard", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  teamId: integer("team_id")
    .notNull()
    .references(() => tournamentTeams.id),
  totalPoints: real("total_points").default(0),
  matchesPlayed: integer("matches_played").default(0),
});
