CREATE TABLE `auction_pool` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`base_price` real NOT NULL,
	`status` text DEFAULT 'AVAILABLE',
	`sold_to_team` integer,
	`sold_price` real,
	`sold_at` text,
	`set_number` integer,
	`availability` text DEFAULT 'FIT',
	`news_notes` text,
	`val_floor` real,
	`val_expected` real,
	`val_ceiling` real,
	`efppm` real,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sold_to_team`) REFERENCES `tournament_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auction_pool_unique` ON `auction_pool` (`tournament_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `career_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`format` text NOT NULL,
	`bat_matches` integer DEFAULT 0,
	`bat_innings` integer DEFAULT 0,
	`bat_runs` integer DEFAULT 0,
	`bat_avg` real DEFAULT 0,
	`bat_sr` real DEFAULT 0,
	`bat_50s` integer DEFAULT 0,
	`bat_100s` integer DEFAULT 0,
	`bat_hs` text,
	`bat_4s` integer DEFAULT 0,
	`bat_6s` integer DEFAULT 0,
	`bowl_innings` integer DEFAULT 0,
	`bowl_wickets` integer DEFAULT 0,
	`bowl_avg` real DEFAULT 0,
	`bowl_econ` real DEFAULT 0,
	`bowl_sr` real DEFAULT 0,
	`bowl_best` text,
	`bowl_4w` integer DEFAULT 0,
	`bowl_5w` integer DEFAULT 0,
	`catches` integer DEFAULT 0,
	`stumpings` integer DEFAULT 0,
	`avg_fantasy_points` real DEFAULT 0,
	`total_fantasy_points` real DEFAULT 0,
	`last_updated` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `career_stats_player_format` ON `career_stats` (`player_id`,`format`);--> statement-breakpoint
CREATE TABLE `leaderboard` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`total_points` real DEFAULT 0,
	`matches_played` integer DEFAULT 0,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `tournament_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_fantasy_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_result_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`bat_runs` integer,
	`bat_balls` integer,
	`bat_4s` integer,
	`bat_6s` integer,
	`bat_dismissed` integer,
	`dismissal_type` text,
	`bowl_balls` integer,
	`bowl_runs` integer,
	`bowl_wickets` integer,
	`bowl_maidens` integer,
	`bowl_dots` integer,
	`bowl_lbw_bowled` integer DEFAULT 0,
	`catches` integer DEFAULT 0,
	`stumpings` integer DEFAULT 0,
	`run_outs` integer DEFAULT 0,
	`direct_run_outs` integer DEFAULT 0,
	`fantasy_points` real DEFAULT 0,
	`in_starting_xi` integer DEFAULT true,
	FOREIGN KEY (`match_result_id`) REFERENCES `match_results`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_performances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`match_id` text NOT NULL,
	`match_date` text NOT NULL,
	`format` text NOT NULL,
	`venue_id` integer,
	`venue_name` text,
	`opposition` text NOT NULL,
	`bat_runs` integer,
	`bat_balls` integer,
	`bat_4s` integer,
	`bat_6s` integer,
	`bat_dismissed` integer DEFAULT false,
	`dismissal_type` text,
	`bowl_balls` integer,
	`bowl_runs` integer,
	`bowl_wickets` integer,
	`bowl_maidens` integer,
	`bowl_dots` integer,
	`bowl_lbw_bowled` integer DEFAULT 0,
	`catches` integer DEFAULT 0,
	`stumpings` integer DEFAULT 0,
	`run_outs` integer DEFAULT 0,
	`direct_run_outs` integer DEFAULT 0,
	`fantasy_points` real DEFAULT 0,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`match_id` text NOT NULL,
	`match_date` text NOT NULL,
	`venue_id` integer,
	`team1` text NOT NULL,
	`team2` text NOT NULL,
	`result` text,
	`status` text DEFAULT 'UPCOMING',
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_opposition_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`opposition` text NOT NULL,
	`format` text NOT NULL,
	`matches` integer DEFAULT 0,
	`bat_runs` integer DEFAULT 0,
	`bat_avg` real DEFAULT 0,
	`bat_sr` real DEFAULT 0,
	`bowl_wickets` integer DEFAULT 0,
	`bowl_avg` real DEFAULT 0,
	`bowl_econ` real DEFAULT 0,
	`avg_fantasy_points` real DEFAULT 0,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_opp_unique` ON `player_opposition_stats` (`player_id`,`opposition`,`format`);--> statement-breakpoint
CREATE TABLE `player_venue_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`venue_id` integer NOT NULL,
	`matches` integer DEFAULT 0,
	`bat_runs` integer DEFAULT 0,
	`bat_avg` real DEFAULT 0,
	`bat_sr` real DEFAULT 0,
	`bowl_wickets` integer DEFAULT 0,
	`bowl_avg` real DEFAULT 0,
	`bowl_econ` real DEFAULT 0,
	`avg_fantasy_points` real DEFAULT 0,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_venue_unique` ON `player_venue_stats` (`player_id`,`venue_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cricsheet_id` text,
	`cricinfo_id` text,
	`name` text NOT NULL,
	`full_name` text,
	`country` text NOT NULL,
	`dob` text,
	`role` text NOT NULL,
	`bat_style` text,
	`bowl_style` text,
	`is_overseas` integer DEFAULT false,
	`profile_url` text,
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_cricsheet_id_unique` ON `players` (`cricsheet_id`);--> statement-breakpoint
CREATE TABLE `retained_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`retention_price` real NOT NULL,
	`retention_slot` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `tournament_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retained_unique` ON `retained_players` (`tournament_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `team_captains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`role` text NOT NULL,
	`match_id` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `tournament_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournament_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`color` text,
	`remaining_purse` real NOT NULL,
	`retained_count` integer DEFAULT 0,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_tournament_unique` ON `tournament_teams` (`tournament_id`,`name`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	`match_format` text NOT NULL,
	`purse_per_team` real NOT NULL,
	`currency_unit` text DEFAULT 'Cr',
	`max_squad_size` integer NOT NULL,
	`max_overseas` integer DEFAULT 4,
	`max_overseas_squad` integer DEFAULT 8,
	`num_captains` integer DEFAULT 1,
	`num_vice_captains` integer DEFAULT 1,
	`status` text DEFAULT 'SETUP',
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`country` text,
	`pitch_type` text,
	`avg_first_innings_score` real,
	`avg_second_innings_score` real,
	`avg_pace_wickets_pct` real,
	`avg_spin_wickets_pct` real,
	`avg_run_rate` real,
	`bounce_rating` integer,
	`turn_rating` integer,
	`swing_rating` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_name_city` ON `venues` (`name`,`city`);