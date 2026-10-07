CREATE TABLE reusable_designs (
 id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('block','template')),
 name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, created_by TEXT NOT NULL,
 updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, deleted_at TEXT
);
--> statement-breakpoint
CREATE INDEX reusable_designs_kind ON reusable_designs(kind,deleted_at,updated_at);
--> statement-breakpoint
CREATE TRIGGER reusable_designs_lease_revision BEFORE INSERT ON workspace_write_checks
WHEN NEW.resource_type='design' AND NOT EXISTS(SELECT 1 FROM reusable_designs WHERE id=NEW.resource_id AND revision=NEW.revision AND deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT,'workspace_revision_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER assets_protect_designs BEFORE UPDATE OF deleted_at ON assets
WHEN NEW.deleted_at IS NOT NULL AND EXISTS(SELECT 1 FROM reusable_designs,json_tree(reusable_designs.data) j WHERE reusable_designs.deleted_at IS NULL AND j.type='text' AND substr(j.value,-(8+length(OLD.id)))='/assets/' || OLD.id)
BEGIN SELECT RAISE(ABORT,'asset_in_use'); END;
--> statement-breakpoint
CREATE TRIGGER designs_active_assets_insert BEFORE INSERT ON reusable_designs
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON substr(j.value,-(8+length(a.id)))='/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER designs_active_assets_update BEFORE UPDATE OF data ON reusable_designs
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON substr(j.value,-(8+length(a.id)))='/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
