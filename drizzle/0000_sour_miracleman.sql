CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`hash` text NOT NULL,
	`metadata` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_hash` ON `assets` (`hash`);--> statement-breakpoint
CREATE TABLE `material_assets` (
	`material_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`material_id`, `asset_id`),
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_slug` ON `materials` (`slug`);--> statement-breakpoint
CREATE TABLE `publication_assets` (
	`publication_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`publication_id`, `asset_id`),
	FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`language` text NOT NULL,
	`slug` text NOT NULL,
	`version` integer NOT NULL,
	`html` text NOT NULL,
	`published_at` text NOT NULL,
	`request_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publication_version` ON `publications` (`campaign_id`,`language`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `publication_slug` ON `publications` (`slug`,`language`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `publication_request` ON `publications` (`request_id`);