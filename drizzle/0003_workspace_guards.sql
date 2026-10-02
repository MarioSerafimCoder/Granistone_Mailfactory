CREATE INDEX campaigns_active_updated ON campaigns(deleted_at, updated_at);
--> statement-breakpoint
CREATE TRIGGER campaign_snapshot_create AFTER INSERT ON campaigns
BEGIN
  INSERT INTO campaign_revisions(campaign_id,revision,data,changed_by,created_at,reason)
  VALUES(NEW.id,NEW.revision,NEW.data,NEW.updated_by,NEW.updated_at,NEW.reason);
END;
--> statement-breakpoint
CREATE TRIGGER campaign_snapshot_update AFTER UPDATE ON campaigns
WHEN NEW.reason != 'autosave' OR NEW.status != OLD.status
  OR json_extract(NEW.data,'$.languageState') != json_extract(OLD.data,'$.languageState') AND (
    json_extract(NEW.data,'$.languageState.pt.status') != json_extract(OLD.data,'$.languageState.pt.status') OR
    json_extract(NEW.data,'$.languageState.en.status') != json_extract(OLD.data,'$.languageState.en.status') OR
    json_extract(NEW.data,'$.languageState.es.status') != json_extract(OLD.data,'$.languageState.es.status'))
  OR NOT EXISTS (SELECT 1 FROM campaign_revisions WHERE campaign_id=NEW.id AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ',NEW.updated_at,'-5 minutes'))
BEGIN
  INSERT INTO campaign_revisions(campaign_id,revision,data,changed_by,created_at,reason)
  VALUES(NEW.id,NEW.revision,NEW.data,NEW.updated_by,NEW.updated_at,NEW.reason);
END;
--> statement-breakpoint
CREATE TRIGGER assets_protect_workspace BEFORE UPDATE OF deleted_at ON assets
WHEN NEW.deleted_at IS NOT NULL AND (
  EXISTS(SELECT 1 FROM campaigns,json_tree(campaigns.data) j WHERE j.type='text' AND j.value LIKE '%/assets/' || OLD.id) OR
  EXISTS(SELECT 1 FROM campaign_revisions,json_tree(campaign_revisions.data) j WHERE j.type='text' AND j.value LIKE '%/assets/' || OLD.id) OR
  EXISTS(SELECT 1 FROM workspace_settings,json_tree(workspace_settings.data) j WHERE j.type='text' AND j.value LIKE '%/assets/' || OLD.id))
BEGIN SELECT RAISE(ABORT,'asset_in_use'); END;
--> statement-breakpoint
CREATE TRIGGER campaigns_active_assets_insert BEFORE INSERT ON campaigns
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON j.value LIKE '%/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER campaigns_active_assets_update BEFORE UPDATE OF data ON campaigns
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON j.value LIKE '%/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER settings_active_assets BEFORE UPDATE OF data ON workspace_settings
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.data) j JOIN assets a ON j.value LIKE '%/assets/' || a.id WHERE a.deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'asset_unavailable'); END;
