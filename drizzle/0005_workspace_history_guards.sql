CREATE TRIGGER campaign_checkpoint BEFORE UPDATE ON campaigns
WHEN NEW.reason IN ('revision','restore','delete','conflict')
BEGIN
  INSERT OR IGNORE INTO campaign_revisions(campaign_id,revision,data,changed_by,created_at,reason)
  VALUES(OLD.id,OLD.revision,OLD.data,OLD.updated_by,OLD.updated_at,'checkpoint');
END;
--> statement-breakpoint
CREATE TRIGGER settings_active_assets_insert BEFORE INSERT ON workspace_settings
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON j.value LIKE '%/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
