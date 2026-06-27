CREATE TABLE `auction_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auction_id` integer NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`color` text,
	`purse` real NOT NULL,
	`remaining_purse` real NOT NULL,
	`is_me` integer DEFAULT false,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_auction_unique` ON `auction_participants` (`auction_id`,`name`);--> statement-breakpoint
CREATE TABLE `auctions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tournament_id` integer,
	`tournament_name` text DEFAULT 'IPL 2026' NOT NULL,
	`match_format` text DEFAULT 'T20' NOT NULL,
	`num_friends` integer NOT NULL,
	`purse_per_friend` real NOT NULL,
	`players_per_friend` integer NOT NULL,
	`num_captains` integer DEFAULT 1,
	`num_vice_captains` integer DEFAULT 1,
	`status` text DEFAULT 'SETUP',
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auction_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`color` text,
	`priority` integer DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_auction_player` ON `watchlist` (`auction_id`,`player_id`);--> statement-breakpoint
ALTER TABLE `auction_pool` ADD `auction_id` integer REFERENCES auctions(id);--> statement-breakpoint
ALTER TABLE `auction_pool` ADD `sold_to_participant` integer REFERENCES auction_participants(id);--> statement-breakpoint
ALTER TABLE `auction_pool` ADD `ipl_team` text;--> statement-breakpoint
ALTER TABLE `auction_pool` ADD `squad_number` integer;