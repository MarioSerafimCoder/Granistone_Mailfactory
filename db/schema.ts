import { sqliteTable, text, integer, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(), objectKey: text('object_key').notNull(),
  hash: text('hash').notNull(), metadata: text('metadata').notNull(),
  category: text('category').notNull(), name: text('name').notNull(),
  createdAt: text('created_at').notNull(), deletedAt: text('deleted_at'),
}, t => [uniqueIndex('assets_hash').on(t.hash)]);
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(), slug: text('slug').notNull(), data: text('data').notNull(),
}, t => [uniqueIndex('materials_slug').on(t.slug)]);
export const materialAssets = sqliteTable('material_assets', {
  materialId: text('material_id').notNull().references(() => materials.id),
  assetId: text('asset_id').notNull().references(() => assets.id),
}, t => [primaryKey({ columns: [t.materialId, t.assetId] })]);
export const publications = sqliteTable('publications', {
  id: text('id').primaryKey(), campaignId: text('campaign_id').notNull(),
  language: text('language').notNull(), slug: text('slug').notNull(),
  version: integer('version').notNull(), html: text('html').notNull(),
  publishedAt: text('published_at').notNull(), requestId: text('request_id').notNull(),
}, t => [uniqueIndex('publication_version').on(t.campaignId, t.language, t.version),
  uniqueIndex('publication_slug').on(t.slug, t.language, t.version),
  uniqueIndex('publication_request').on(t.requestId)]);
export const publicationAssets = sqliteTable('publication_assets', {
  publicationId: text('publication_id').notNull().references(() => publications.id),
  assetId: text('asset_id').notNull().references(() => assets.id),
}, t => [primaryKey({ columns: [t.publicationId, t.assetId] })]);
