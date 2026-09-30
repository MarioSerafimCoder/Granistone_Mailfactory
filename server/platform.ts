import type { D1Database, R2Bucket, Fetcher } from '@cloudflare/workers-types';
export interface Env {
  DB: D1Database; BUCKET: R2Bucket; ASSETS: Fetcher;
  SITE_ORIGIN: string; EDITOR_EMAILS: string; REMOTE_HOSTS?: string;
}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireEditor(request: Request, env: Env) {
  const email = request.headers.get('oai-authenticated-user-email')?.toLowerCase();
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id || !email) throw new HttpError(401, 'Entre com ChatGPT para usar o armazenamento online.');
  if (!env.EDITOR_EMAILS?.toLowerCase().split(',').map(s => s.trim()).includes(email))
    throw new HttpError(403, 'Esta conta não tem permissão para editar o catálogo.');
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('origin') !== env.SITE_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site')
      throw new HttpError(403, 'Origem da solicitação não autorizada.');
  }
  return { id, email };
}
export function identifier(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new HttpError(400, 'Identificador inválido.');
  return value;
}
export function clean(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
export async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'Arquivo ou conteúdo muito grande.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) throw new HttpError(413, 'Arquivo ou conteúdo muito grande.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function jsonBody(request: Request) {
  try { return JSON.parse(new TextDecoder().decode(await limitedBody(request, 2_000_000))); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'JSON inválido.'); }
}
