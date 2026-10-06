CREATE TABLE `asset_folders` (
	`asset_id` text NOT NULL,
	`folder_path` text NOT NULL,
	PRIMARY KEY(`asset_id`, `folder_path`),
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `asset_folders_path` ON `asset_folders` (`folder_path`);