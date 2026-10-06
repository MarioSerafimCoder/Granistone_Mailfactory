import { AssetRepository } from './assets';
import { MaterialRepository } from './materials';
import { PublicationRepository } from './publications';
import { publicationInput, runPreflight } from './preflight';
import { HttpError, jsonBody, limitedBody, type Env } from './platform';
import { CollaborationRepository, guardedEnv, membership, requireRole, session } from './collaboration';
import { MAX_UPLOAD } from './images';
import { renderEmail } from '@/export/render';
import { translateContent } from './translation';
import { CampaignRepository } from './campaigns';
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url); const path = url.pathname;
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    try {
      const assets = new AssetRepository(env); const publications = new PublicationRepository(env);
      if (['GET', 'HEAD'].includes(request.method)) {
        const asset = path.match(/^\/assets\/([a-f0-9]{64})$/);
        if (asset) return await assets.serve(asset[1], request);
        const email = path.match(/^\/emails\/([a-z0-9-]+)\/(pt|en|es)(?:\/v\/([1-9]\d{0,8}))?$/);
        if (email) return await publications.serve(email[1], email[2], email[3] ? Number(email[3]) : undefined, request);
      }
      if (path.startsWith('/assets/') || path.startsWith('/emails/')) throw new HttpError(404, 'Recurso não encontrado.');
      if (!path.startsWith('/api/')) return await env.ASSETS.fetch(request as never) as unknown as Response;
      if (path === '/api/session' && request.method === 'GET') {
        return json(await session(request, env));
      }
      const actor = await membership(request, env);
      if (path.startsWith('/api/workspace/members') || path.startsWith('/api/workspace/presence') || path.startsWith('/api/workspace/edit-locks')) {
        const memberApi = path.match(/^\/api\/workspace\/members\/([a-zA-Z0-9_-]{1,100})$/);
        const lockApi = path.match(/^\/api\/workspace\/edit-locks\/(acquire|renew|release)$/);
        const required = path.startsWith('/api/workspace/members') ? 'admin' : lockApi ? 'editor' : 'member';
        const collaboration = new CollaborationRepository(guardedEnv(env, actor, request, '', '', required), actor);
        if (path === '/api/workspace/members') {
          if (request.method === 'GET') return json(await collaboration.members());
          if (request.method === 'POST') return json(await collaboration.add(await jsonBody(request)), 201);
        }
        if (path === '/api/workspace/members/events' && request.method === 'GET') return json(await collaboration.events());
        if (memberApi && request.method === 'PATCH') return json(await collaboration.change(memberApi[1], await jsonBody(request)));
        if (memberApi && request.method === 'DELETE') return json(await collaboration.change(memberApi[1], {}, true));
        if (path === '/api/workspace/presence' && request.method === 'GET') return json(await collaboration.presence());
        if (path === '/api/workspace/presence/heartbeat' && request.method === 'POST') return json(await collaboration.heartbeat(await jsonBody(request)));
        if (path === '/api/workspace/presence/session' && request.method === 'DELETE') return json(await collaboration.leave(await jsonBody(request)));
        if (lockApi && request.method === 'POST') {
          const input = await jsonBody(request);
          return json(await new CollaborationRepository(guardedEnv(env, actor, request, '', '', input.resourceType === 'brand' ? 'admin' : 'editor'), actor).lock(input, lockApi[1]));
        }
        throw new HttpError(404, 'Rota não encontrada.');
      }
      const mutating = !['GET', 'HEAD'].includes(request.method);
      let resourceType = '', resourceId = '', requiredRole = 'editor';
      const protectedCampaign = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_-]+)(?:\/.*)?$/);
      const protectedMaterial = path.match(/^\/api\/materials\/([a-zA-Z0-9_-]+)$/);
      const protectedAsset = path.match(/^\/api\/assets\/([a-f0-9]{64})$/);
      if (mutating) {
        if (protectedCampaign) { resourceType = 'campaign'; resourceId = protectedCampaign[1]; }
        if (protectedMaterial) { resourceType = 'material'; resourceId = protectedMaterial[1]; }
        if (protectedAsset) { resourceType = 'asset'; resourceId = protectedAsset[1]; }
        if (path === '/api/workspace/settings') { resourceType = 'brand'; resourceId = 'brand'; requiredRole = 'admin'; }
        if (request.method === 'DELETE' || /\/restore$/.test(path)) requiredRole = 'admin';
        // Rendering and preflight are read operations despite using POST.
        if (!['/api/render', '/api/preflight'].includes(path)) requireRole(actor, requiredRole === 'admin' ? 'admin' : 'editor');
      }
      const revision = request.headers.get('x-resource-revision');
      const baseEnv = env;
      env = guardedEnv(env, actor, request, resourceType, resourceId, requiredRole, revision === null ? null : Number(revision));
      const protectedAssets = new AssetRepository(env), protectedMaterials = new MaterialRepository(env), protectedPublications = new PublicationRepository(env);
      const campaigns = new CampaignRepository(env, actor);
      if (path === '/api/campaigns') {
        if (request.method === 'GET') return json(await campaigns.list());
        if (request.method === 'POST') return json(await campaigns.create(await jsonBody(request)), 201);
      }
      const campaignApi = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_-]{1,100})(?:\/(restore|history)(?:\/([1-9]\d*)\/restore)?)?$/);
      if (campaignApi) {
        const [, id, action, revision] = campaignApi;
        if (!action && request.method === 'GET') return json(await campaigns.get(id));
        if (!action && request.method === 'PUT') return json(await campaigns.update(id, await jsonBody(request)));
        if (!action && request.method === 'DELETE') return json(await campaigns.update(id, await jsonBody(request), 'delete'));
        if (action === 'restore' && request.method === 'POST') return json(await campaigns.update(id, await jsonBody(request), 'restore'));
        if (action === 'history' && !revision && request.method === 'GET') return json(await campaigns.history(id));
        if (action === 'history' && revision && request.method === 'POST') return json(await campaigns.update(id, await jsonBody(request), 'revision', Number(revision)));
      }
      if (path === '/api/workspace/settings') {
        if (request.method === 'GET') return json(await campaigns.brand());
        if (request.method === 'PUT') return json(await campaigns.saveBrand(await jsonBody(request)));
      }
      if (path === '/api/assets') {
        if (request.method === 'GET') return json(await protectedAssets.list(url.searchParams.get('q') || '', url.searchParams.get('category') || '', Math.max(0, Math.min(100000, Number(url.searchParams.get('offset')) || 0))));
        if (request.method === 'POST') {
          let metadata;
          try { metadata = JSON.parse(decodeURIComponent(request.headers.get('x-asset-metadata') || '%7B%7D')); }
          catch { throw new HttpError(400, 'Metadados inválidos.'); }
          if (!metadata || typeof metadata !== 'object' || typeof metadata.fileName !== 'string') throw new HttpError(400, 'Nome do arquivo obrigatório.');
          return json(await protectedAssets.create(await limitedBody(request, MAX_UPLOAD), request.headers.get('content-type') || '', metadata.fileName, metadata), 201);
        }
      }
      const assetApi = path.match(/^\/api\/assets\/([a-f0-9]{64})(\/usage)?$/);
      if (assetApi) {
        if (request.method === 'GET') return json(assetApi[2] ? await protectedAssets.usage(assetApi[1]) : await protectedAssets.get(assetApi[1]));
        if (!assetApi[2] && request.method === 'PATCH') return json(await protectedAssets.update(assetApi[1], await jsonBody(request)));
        if (!assetApi[2] && request.method === 'DELETE') return json(await protectedAssets.remove(assetApi[1]));
      }
      if (path === '/api/materials') {
        if (request.method === 'GET') return json(await protectedMaterials.list());
        if (request.method === 'POST') return json(await protectedMaterials.save(await jsonBody(request)), 201);
      }
      const materialApi = path.match(/^\/api\/materials\/([a-zA-Z0-9_-]{1,100})$/);
      if (materialApi) {
        if (request.method === 'GET') return json(await protectedMaterials.get(materialApi[1]));
        if (request.method === 'PUT') return json(await protectedMaterials.save(await jsonBody(request), materialApi[1]));
      }
      if (path === '/api/preflight' && request.method === 'POST') return json(await runPreflight(publicationInput(await jsonBody(request)), env));
      if (path === '/api/translate' && request.method === 'POST') return json(await translateContent(await jsonBody(request), env));
      if (path === '/api/render' && request.method === 'POST') {
        const input = publicationInput(await jsonBody(request));
        return json({ html: await renderEmail(input.campaign, input.language, input.brand) });
      }
      if (path === '/api/publications') {
        if (request.method === 'GET') return json(await protectedPublications.list(url.searchParams.get('campaignId') || ''));
        if (request.method === 'POST') {
          const key = request.headers.get('idempotency-key');
          if (!key) throw new HttpError(400, 'Identificador de publicação obrigatório.');
          const input = publicationInput(await jsonBody(request));
          const shared = await campaigns.get(input.campaign.id).catch(error => { if (error instanceof HttpError && error.status === 404) return null; throw error; });
          const publicationEnv = guardedEnv(baseEnv, actor, request, shared ? 'campaign' : '', shared ? input.campaign.id : '');
          const published = await new PublicationRepository(publicationEnv).publish(input, key);
          return json(published, published.publication ? 201 : 422);
        }
      }
      throw new HttpError(404, 'Rota não encontrada.');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      const message = String(error);
      if (message.includes('workspace_forbidden')) return json({ error: 'Seu acesso ou sua função foi alterado. Atualize a sessão.' }, 403);
      if (message.includes('workspace_lock_lost')) return json({ error: 'Sua reserva de edição expirou ou pertence a outra sessão. Suas alterações locais foram preservadas.' }, 423);
      if (message.includes('workspace_revision_conflict')) return json({ error: 'Este recurso foi alterado. Carregue a versão atual antes de salvar.' }, 409);
      if (message.includes('workspace_last_admin')) return json({ error: 'O workspace precisa ter pelo menos um administrador.' }, 409);
      if (message.includes('workspace_members.email')) return json({ error: 'Este e-mail já pertence ao workspace.' }, 409);
      console.error('Studio request failed', path, error);
      return json({ error: 'Serviço temporariamente indisponível. Seus rascunhos foram preservados.' }, 503);
    }
  },
};
export default worker;
