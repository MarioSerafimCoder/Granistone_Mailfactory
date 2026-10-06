import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { Env } from '../server/platform';
export function platformFixture() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('drizzle').filter(n => n.endsWith('.sql')).sort()) db.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  type Value = string | number | null;
  class Statement {
    values: Value[] = [];
    constructor(readonly sql: string) {}
    bind(...values: Value[]) { this.values = values; return this; }
    async first() { return db.prepare(this.sql).get(...this.values) ?? null; }
    async all() { return { results: db.prepare(this.sql).all(...this.values), success: true }; }
    async run() { return { success: true, meta: db.prepare(this.sql).run(...this.values) }; }
  }
  const objects = new Map<string, { bytes: Uint8Array; mime: string }>();
  const env = {
    SITE_ORIGIN: 'https://studio.example.com', EDITOR_EMAILS: 'editor@example.com', REMOTE_HOSTS: '',
    DB: { prepare: (sql: string) => new Statement(sql), async batch(statements: Statement[]) {
      db.exec('BEGIN');
      // A D1 batch is serialized as one transaction. Do not yield between
      // synchronous SQLite statements or concurrent requests interleave BEGIN.
      try { const result = []; for (const s of statements) result.push({ success: true, meta: db.prepare(s.sql).run(...s.values) }); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    } },
    BUCKET: {
      async put(key: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string } }) { objects.set(key, { bytes: new Uint8Array(bytes), mime: options.httpMetadata.contentType }); },
      async head(key: string) { return objects.has(key) ? { size: objects.get(key)!.bytes.length } : null; },
      async get(key: string) {
        const object = objects.get(key); if (!object) return null;
        return { body: new Response(new Uint8Array(object.bytes)).body, size: object.bytes.length, httpEtag: `"${key}"` };
      },
    },
    ASSETS: { async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      if (!/^\/brand\/[a-z0-9.-]+$/.test(path)) return new Response('missing', { status: 404 });
      try { const bytes = readFileSync(`public${path}`); return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length) } }); }
      catch { return new Response('missing', { status: 404 }); }
    } },
  } as unknown as Env;
  return { env, db, objects, close: () => db.close() };
}
