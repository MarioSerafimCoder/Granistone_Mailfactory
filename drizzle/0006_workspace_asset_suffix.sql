-- D1 limits LIKE patterns; SHA-256 asset IDs exceed that limit. Compare suffixes directly.
DROP TRIGGER assets_protect_workspace;
--> statement-breakpoint
CREATE TRIGGER assets_protect_workspace BEFORE UPDATE OF deleted_at ON assets
WHEN NEW.deleted_at IS NOT NULL AND (
  EXISTS(SELECT 1 FROM campaigns,json_tree(campaigns.data) j WHERE j.type='text' AND substr(j.value,-(8+length(OLD.id)))='/assets/' || OLD.id) OR
  EXISTS(SELECT 1 FROM campaign_revisions,json_tree(campaign_revisions.data) j WHERE j.type='text' AND substr(j.value,-(8+length(OLD.id)))='/assets/' || OLD.id) OR
  EXISTS(SELECT 1 FROM workspace_settings,json_tree(workspace_settings.data) j WHERE j.type='text' AND substr(j.value,-(8+length(OLD.id)))='/assets/' || OLD.id))
BEGIN SELECT RAISE(ABORT,'asset_in_use'); END;
--> statement-breakpoint
DROP TRIGGER campaigns_active_assets_insert;
--> statement-breakpoint
CREATE TRIGGER campaigns_active_assets_insert BEFORE INSERT ON campaigns
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON substr(j.value,-(8+length(a.id)))='/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
--> statement-breakpoint
DROP TRIGGER campaigns_active_assets_update;
--> statement-breakpoint
CREATE TRIGGER campaigns_active_assets_update BEFORE UPDATE OF data ON campaigns
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON substr(j.value,-(8+length(a.id)))='/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
--> statement-breakpoint
DROP TRIGGER settings_active_assets;
--> statement-breakpoint
CREATE TRIGGER settings_active_assets BEFORE UPDATE OF data ON workspace_settings
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON substr(j.value,-(8+length(a.id)))='/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
--> statement-breakpoint
DROP TRIGGER settings_active_assets_insert;
--> statement-breakpoint
CREATE TRIGGER settings_active_assets_insert BEFORE INSERT ON workspace_settings
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON substr(j.value,-(8+length(a.id)))='/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
