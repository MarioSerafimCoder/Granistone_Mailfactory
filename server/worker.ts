import { AssetRepository } from './assets';
import { MaterialRepository } from './materials';
import { PublicationRepository } from './publications';
import { publicationInput, runPreflight } from './preflight';
import { requireEditor, HttpError, jsonBody, limitedBody, type Env } from './platform';
import { MAX_UPLOAD } from './images';
import { renderEmail } from '@/export/render';
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url); const path = url.pathname;
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    try {
      const assets = new AssetRepository(env); const materials = new MaterialRepository(env); const publications = new PublicationRepository(env);
      if (['GET', 'HEAD'].includes(request.method)) {
        const asset = path.match(/^\/assets\/([a-f0-9]{64})$/);
        if (asset) return await assets.serve(asset[1], request);
        const email = path.match(/^\/emails\/([a-z0-9-]+)\/(pt|en)(?:\/v\/([1-9]\d{0,8}))?$/);
        if (email) return await publications.serve(email[1], email[2], email[3] ? Number(email[3]) : undefined, request);
      }
      if (path.startsWith('/assets/') || path.startsWith('/emails/')) throw new HttpError(404, 'Recurso não encontrado.');
      if (!path.startsWith('/api/')) return await env.ASSETS.fetch(request as never) as unknown as Response;
      const editor = requireEditor(request, env);
      if (path === '/api/session' && request.method === 'GET') return json({ editor: true, email: editor.email, origin: env.SITE_ORIGIN });
      if (path === '/api/assets') {
        if (request.method === 'GET') return json(await assets.list(url.searchParams.get('q') || '', url.searchParams.get('category') || '', Math.max(0, Math.min(100000, Number(url.searchParams.get('offset')) || 0))));
        if (request.method === 'POST') {
          let metadata;
          try { metadata = JSON.parse(decodeURIComponent(request.headers.get('x-asset-metadata') || '%7B%7D')); }
          catch { throw new HttpError(400, 'Metadados inválidos.'); }
          if (!metadata || typeof metadata !== 'object' || typeof metadata.fileName !== 'string') throw new HttpError(400, 'Nome do arquivo obrigatório.');
          return json(await assets.create(await limitedBody(request, MAX_UPLOAD), request.headers.get('content-type') || '', metadata.fileName, metadata), 201);
        }
      }
      const assetApi = path.match(/^\/api\/assets\/([a-f0-9]{64})(\/usage)?$/);
      if (assetApi) {
        if (request.method === 'GET') return json(assetApi[2] ? await assets.usage(assetApi[1]) : await assets.get(assetApi[1]));
        if (!assetApi[2] && request.method === 'PATCH') return json(await assets.update(assetApi[1], await jsonBody(request)));
        if (!assetApi[2] && request.method === 'DELETE') return json(await assets.remove(assetApi[1]));
      }
      if (path === '/api/materials') {
        if (request.method === 'GET') return json(await materials.list());
        if (request.method === 'POST') return json(await materials.save(await jsonBody(request)), 201);
      }
      const materialApi = path.match(/^\/api\/materials\/([a-zA-Z0-9_-]{1,100})$/);
      if (materialApi) {
        if (request.method === 'GET') return json(await materials.get(materialApi[1]));
        if (request.method === 'PUT') return json(await materials.save(await jsonBody(request), materialApi[1]));
      }
      if (path === '/api/preflight' && request.method === 'POST') return json(await runPreflight(publicationInput(await jsonBody(request)), env));
      if (path === '/api/render' && request.method === 'POST') {
        const input = publicationInput(await jsonBody(request));
        return json({ html: await renderEmail(input.campaign, input.language, input.brand) });
      }
      if (path === '/api/publications') {
        if (request.method === 'GET') return json(await publications.list(url.searchParams.get('campaignId') || ''));
        if (request.method === 'POST') {
          const key = request.headers.get('idempotency-key');
          if (!key) throw new HttpError(400, 'Identificador de publicação obrigatório.');
          const published = await publications.publish(publicationInput(await jsonBody(request)), key);
          return json(published, published.publication ? 201 : 422);
        }
      }
      throw new HttpError(404, 'Rota não encontrada.');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('Studio request failed', path, error);
      return json({ error: 'Serviço temporariamente indisponível. Seus rascunhos foram preservados.' }, 503);
    }
  },
};
export default worker;
