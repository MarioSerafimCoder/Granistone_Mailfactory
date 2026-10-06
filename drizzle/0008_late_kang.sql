CREATE TABLE `workspace_edit_locks` (
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`session_id` text NOT NULL,
	`tab_id` text NOT NULL,
	`token` text NOT NULL,
	`generation` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`resource_type`, `resource_id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_member_events` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_email` text NOT NULL,
	`previous_role` text,
	`new_role` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_member_email` ON `workspace_members` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_presence_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`session_id` text NOT NULL,
	`tab_id` text NOT NULL,
	`location` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`last_activity_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_presence_expiry` ON `workspace_presence_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `workspace_write_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`owner` integer NOT NULL,
	`required_role` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`session_id` text NOT NULL,
	`tab_id` text NOT NULL,
	`token` text NOT NULL,
	`generation` integer NOT NULL,
	`revision` integer
);
--> statement-breakpoint
ALTER TABLE `assets` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `revision` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER workspace_check_write BEFORE INSERT ON workspace_write_checks BEGIN
  SELECT CASE WHEN NEW.owner=0 AND NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE email=NEW.email AND status='active'
      AND (NEW.required_role='member' OR role='admin' OR (NEW.required_role='editor' AND role='editor'))
  ) THEN RAISE(ABORT,'workspace_forbidden') END;
  SELECT CASE WHEN NEW.resource_type<>'' AND NOT EXISTS (
    SELECT 1 FROM workspace_edit_locks WHERE resource_type=NEW.resource_type AND resource_id=NEW.resource_id
      AND user_id=NEW.user_id AND session_id=NEW.session_id AND tab_id=NEW.tab_id AND token=NEW.token
      AND generation=NEW.generation AND expires_at>CAST(strftime('%s','now') AS INTEGER)
  ) THEN RAISE(ABORT,'workspace_lock_lost') END;
  SELECT CASE WHEN NEW.resource_type='material' AND NOT EXISTS(SELECT 1 FROM materials WHERE id=NEW.resource_id AND revision=NEW.revision)
    THEN RAISE(ABORT,'workspace_revision_conflict') END;
  SELECT CASE WHEN NEW.resource_type='asset' AND NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.resource_id AND revision=NEW.revision)
    THEN RAISE(ABORT,'workspace_revision_conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_last_admin_update BEFORE UPDATE OF role,status ON workspace_members
WHEN OLD.role='admin' AND OLD.status='active' AND (NEW.role<>'admin' OR NEW.status<>'active')
AND (SELECT count(*) FROM workspace_members WHERE role='admin' AND status='active')<=1
BEGIN SELECT RAISE(ABORT,'workspace_last_admin'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_last_admin_delete BEFORE DELETE ON workspace_members
WHEN OLD.role='admin' AND OLD.status='active'
AND (SELECT count(*) FROM workspace_members WHERE role='admin' AND status='active')<=1
BEGIN SELECT RAISE(ABORT,'workspace_last_admin'); END;
