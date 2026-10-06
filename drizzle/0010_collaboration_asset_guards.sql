-- Additive folder imports must respect an active metadata editing lease too.
CREATE TRIGGER collaboration_asset_update BEFORE UPDATE ON assets
WHEN EXISTS(SELECT 1 FROM workspace_write_checks)
AND EXISTS(SELECT 1 FROM workspace_edit_locks l WHERE l.resource_type='asset' AND l.resource_id=OLD.id AND l.expires_at>CAST(strftime('%s','now') AS INTEGER)
  AND NOT EXISTS(SELECT 1 FROM workspace_write_checks c WHERE c.resource_type='asset' AND c.resource_id=OLD.id AND c.user_id=l.user_id AND c.session_id=l.session_id AND c.tab_id=l.tab_id AND c.token=l.token AND c.generation=l.generation))
BEGIN SELECT RAISE(ABORT,'workspace_lock_lost'); END;
--> statement-breakpoint
CREATE TRIGGER collaboration_folder_insert BEFORE INSERT ON asset_folders
WHEN EXISTS(SELECT 1 FROM workspace_write_checks)
AND EXISTS(SELECT 1 FROM workspace_edit_locks l WHERE l.resource_type='asset' AND l.resource_id=NEW.asset_id AND l.expires_at>CAST(strftime('%s','now') AS INTEGER)
  AND NOT EXISTS(SELECT 1 FROM workspace_write_checks c WHERE c.resource_type='asset' AND c.resource_id=NEW.asset_id AND c.user_id=l.user_id AND c.session_id=l.session_id AND c.tab_id=l.tab_id AND c.token=l.token AND c.generation=l.generation))
BEGIN SELECT RAISE(ABORT,'workspace_lock_lost'); END;
--> statement-breakpoint
CREATE TRIGGER collaboration_folder_revision AFTER INSERT ON asset_folders
BEGIN UPDATE assets SET revision=revision+1 WHERE id=NEW.asset_id; END;
