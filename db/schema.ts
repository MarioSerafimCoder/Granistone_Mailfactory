import { sqliteTable, text, integer, uniqueIndex, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(), title: text('title').notNull(), date: text('date').notNull(),
  status: text('status').notNull(), language: text('language').notNull(), data: text('data').notNull(),
  revision: integer('revision').notNull(), createdAt: text('created_at').notNull(), createdBy: text('created_by').notNull(),
  updatedAt: text('updated_at').notNull(), updatedBy: text('updated_by').notNull(),
  deletedAt: text('deleted_at'), deletedBy: text('deleted_by'), reason: text('reason').notNull(),
});
export const campaignRevisions = sqliteTable('campaign_revisions', {
  campaignId: text('campaign_id').notNull().references(() => campaigns.id), revision: integer('revision').notNull(),
  data: text('data').notNull(), changedBy: text('changed_by').notNull(), createdAt: text('created_at').notNull(), reason: text('reason').notNull(),
}, t => [primaryKey({ columns: [t.campaignId, t.revision] })]);
export const workspaceSettings = sqliteTable('workspace_settings', {
  key: text('key').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(), updatedBy: text('updated_by').notNull(),
});
export const workspaceMutations = sqliteTable('workspace_mutations', {
  id: text('id').primaryKey(), resource: text('resource').notNull(), actor: text('actor').notNull(),
  fingerprint: text('fingerprint').notNull(), response: text('response').notNull(),
});

export const assets = sqliteTable('assets', {
  revision: integer('revision').notNull().default(1),
  id: text('id').primaryKey(), objectKey: text('object_key').notNull(),
  hash: text('hash').notNull(), metadata: text('metadata').notNull(),
  category: text('category').notNull(), name: text('name').notNull(),
  createdAt: text('created_at').notNull(), deletedAt: text('deleted_at'),
}, t => [uniqueIndex('assets_hash').on(t.hash)]);
export const assetFolders = sqliteTable('asset_folders', {
  assetId: text('asset_id').notNull().references(() => assets.id),
  folderPath: text('folder_path').notNull(),
}, t => [primaryKey({ columns: [t.assetId, t.folderPath] }), index('asset_folders_path').on(t.folderPath)]);
export const materials = sqliteTable('materials', {
  revision: integer('revision').notNull().default(1),
  id: text('id').primaryKey(), slug: text('slug').notNull(), data: text('data').notNull(),
}, t => [uniqueIndex('materials_slug').on(t.slug)]);
export const materialAssets = sqliteTable('material_assets', {
  materialId: text('material_id').notNull().references(() => materials.id),
  assetId: text('asset_id').notNull().references(() => assets.id),
}, t => [primaryKey({ columns: [t.materialId, t.assetId] })]);
export const publications = sqliteTable('publications', {
  sourceSignature: text('source_signature').notNull().default(''),
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

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(), email: text('email').notNull(), name: text('name').notNull().default(''),
  role: text('role').notNull(), status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(), createdBy: text('created_by').notNull(),
  updatedAt: text('updated_at').notNull(), lastSeenAt: text('last_seen_at'),
}, t => [uniqueIndex('workspace_member_email').on(t.email)]);
export const workspaceMemberEvents = sqliteTable('workspace_member_events', {
  targetEmail: text('target_email').notNull().default(''),
  id: text('id').primaryKey(), memberId: text('member_id').notNull(), action: text('action').notNull(),
  actorEmail: text('actor_email').notNull(), previousRole: text('previous_role'), newRole: text('new_role'),
  createdAt: text('created_at').notNull(),
});
export const workspacePresence = sqliteTable('workspace_presence_sessions', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), email: text('email').notNull(),
  name: text('name').notNull(), sessionId: text('session_id').notNull(), tabId: text('tab_id').notNull(),
  location: text('location').notNull(), resourceType: text('resource_type').notNull(), resourceId: text('resource_id').notNull(),
  lastActivityAt: integer('last_activity_at').notNull(), lastSeenAt: integer('last_seen_at').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('workspace_presence_expiry').on(t.expiresAt)]);
export const workspaceEditLocks = sqliteTable('workspace_edit_locks', {
  resourceType: text('resource_type').notNull(), resourceId: text('resource_id').notNull(),
  userId: text('user_id').notNull(), email: text('email').notNull(), sessionId: text('session_id').notNull(), tabId: text('tab_id').notNull(),
  token: text('token').notNull(), generation: integer('generation').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [primaryKey({ columns: [t.resourceType, t.resourceId] })]);
export const workspaceWriteChecks = sqliteTable('workspace_write_checks', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), email: text('email').notNull(), owner: integer('owner').notNull(),
  requiredRole: text('required_role').notNull(), resourceType: text('resource_type').notNull(), resourceId: text('resource_id').notNull(),
  sessionId: text('session_id').notNull(), tabId: text('tab_id').notNull(), token: text('token').notNull(),
  generation: integer('generation').notNull(), revision: integer('revision'),
});
