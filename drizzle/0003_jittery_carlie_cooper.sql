ALTER TABLE `marks` ADD `gps_encrypted` text;--> statement-breakpoint
ALTER TABLE `users` ADD `private_gps_enabled` integer DEFAULT false NOT NULL;