CREATE TRIGGER assets_protect_references BEFORE UPDATE OF deleted_at ON assets
WHEN NEW.deleted_at IS NOT NULL AND (
  EXISTS (SELECT 1 FROM publication_assets WHERE asset_id=OLD.id) OR
  EXISTS (SELECT 1 FROM material_assets WHERE asset_id=OLD.id)
)
BEGIN SELECT RAISE(ABORT, 'asset_in_use'); END;
--> statement-breakpoint
CREATE TRIGGER publication_asset_active BEFORE INSERT ON publication_assets
WHEN NOT EXISTS (SELECT 1 FROM assets WHERE id=NEW.asset_id AND deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT, 'asset_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER material_asset_active BEFORE INSERT ON material_assets
WHEN NOT EXISTS (SELECT 1 FROM assets WHERE id=NEW.asset_id AND deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT, 'asset_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER publications_no_update BEFORE UPDATE ON publications
BEGIN SELECT RAISE(ABORT, 'publication_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER publications_no_delete BEFORE DELETE ON publications
BEGIN SELECT RAISE(ABORT, 'publication_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER publication_assets_no_delete BEFORE DELETE ON publication_assets
BEGIN SELECT RAISE(ABORT, 'publication_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER publication_assets_no_update BEFORE UPDATE ON publication_assets
BEGIN SELECT RAISE(ABORT, 'publication_immutable'); END;
