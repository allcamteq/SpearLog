CREATE TABLE `catches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`species` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`weight` real,
	`size` real,
	`mark_id` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mark_id`) REFERENCES `marks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `marks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`location` text,
	`location_details` text,
	`lat` real,
	`lng` real,
	`free_text` text,
	`comments` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marks_user_name_idx` ON `marks` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `option_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`category` text NOT NULL,
	`value` text NOT NULL,
	`lat` real,
	`lng` real,
	`resolved_address` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_user_category_value_idx` ON `option_values` (`user_id`,`category`,`value`);--> statement-breakpoint
CREATE TABLE `provider_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`user_id` integer,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_usage_provider_user_day_idx` ON `provider_usage` (`provider`,`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `rate_limit_hits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_hits_bucket_idx` ON `rate_limit_hits` (`bucket`,`created_at`);--> statement-breakpoint
CREATE TABLE `session_marks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`mark_id` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mark_id`) REFERENCES `marks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`url` text NOT NULL,
	`pathname` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`date` text,
	`location` text,
	`location_details` text,
	`country` text,
	`number_of_dives` integer,
	`comments` text,
	`high_tide_time` text,
	`low_tide_time` text,
	`start_time` text,
	`session_length_hours` real,
	`tide_type` text,
	`slack_tide_time` text,
	`tide_ratio` real,
	`current` text,
	`current_speed_kt` real,
	`sea_condition` text,
	`wind_condition` text,
	`wind_direction` real,
	`pressure` real,
	`visibility` real,
	`depth_from` real,
	`depth_to` real,
	`gps_point` text,
	`rating` integer,
	`fish_abundance` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);