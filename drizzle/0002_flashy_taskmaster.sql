CREATE TABLE `campaign_revisions` (
	`campaign_id` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text NOT NULL,
	`reason` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `revision`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`language` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`deleted_at` text,
	`deleted_by` text,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`resource` text NOT NULL,
	`actor` text NOT NULL,
	`fingerprint` text NOT NULL,
	`response` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
