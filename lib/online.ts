import type { EmailPublication, MediaAsset, OnlineMaterial, PreflightResult, PublicationInput, TranslationRequest, TranslationResult } from '@/types/online';
import type { Campaign, BrandSettings } from '@/types/campaign';
import type { SharedCampaign, SharedBrand, CampaignRevision } from '@/types/workspace';
import type { PresenceEntry, ResourceType, WorkspaceMember, WorkspaceSession } from '@/types/collaboration';
import { editHeaders, invalidateLease } from './edit-leases';
import type { DesignInput, SavedDesign } from '@/types/design';
import { OnlineError } from './online-error';
export { OnlineError } from './online-error';
function resource(path: string, body?: BodyInit | null): [ResourceType, string] | undefined {
  const match = path.match(/^\/api\/(campaigns|materials|assets|designs)\/([a-zA-Z0-9_-]+)/);
  if (match) return [{ campaigns: 'campaign', materials: 'material', assets: 'asset', designs: 'design' }[match[1]] as ResourceType, match[2]];
  if (path === '/api/workspace/settings') return ['brand', 'brand'];
  if (path === '/api/publications' && typeof body === 'string') return ['campaign', JSON.parse(body).campaign.id];
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const editing = options?.method && !['GET', 'HEAD'].includes(options.method) ? resource(path, options.body) : undefined;
  const response = await fetch(path, { ...options, headers: { ...(editing ? editHeaders(...editing) : {}), ...options?.headers }, credentials: 'same-origin' });
  let value;
  try { value = await response.json(); } catch { throw new OnlineError('Servidor online indisponível neste endereço.', response.status); }
  if (!response.ok) {
    if (editing && [401, 403, 423].includes(response.status)) invalidateLease(...editing);
    throw new OnlineError(value.error || 'A operação não foi concluída.', response.status);
  }
  return value as T;
}
const json = (value: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const online = {
  designs: {
    list: (kind: 'block' | 'template') => api<SavedDesign[]>(`/api/designs?kind=${kind}`),
    get: (id: string) => api<SavedDesign>(`/api/designs/${encodeURIComponent(id)}`),
    save: (value: DesignInput, existing = false) => api<SavedDesign>(existing ? `/api/designs/${encodeURIComponent(value.id)}` : '/api/designs', { method: existing ? 'PUT' : 'POST', ...json(value), headers: { 'Content-Type': 'application/json', 'X-Resource-Revision': String(value.revision) } }),
    remove: (id: string, revision: number) => api(`/api/designs/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Resource-Revision': String(revision) } }),
  },
  campaigns: {
    list: () => api<SharedCampaign[]>('/api/campaigns'),
    get: (id: string) => api<SharedCampaign>(`/api/campaigns/${encodeURIComponent(id)}`),
    create: (campaign: Campaign, requestId: string) => api<SharedCampaign>('/api/campaigns', { method: 'POST', ...json({ campaign, requestId }) }),
    save: (campaign: Campaign, revision: number, requestId: string) => api<SharedCampaign>(`/api/campaigns/${encodeURIComponent(campaign.id)}`, { method: 'PUT', ...json({ campaign, revision, requestId }) }),
    remove: (id: string, revision: number, requestId: string) => api<SharedCampaign>(`/api/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE', ...json({ revision, requestId }) }),
    restore: (id: string, revision: number) => api<SharedCampaign>(`/api/campaigns/${encodeURIComponent(id)}/restore`, { method: 'POST', ...json({ revision, requestId: crypto.randomUUID() }) }),
    history: (id: string) => api<CampaignRevision[]>(`/api/campaigns/${encodeURIComponent(id)}/history`),
    restoreRevision: (id: string, revision: number, historical: number) => api<SharedCampaign>(`/api/campaigns/${encodeURIComponent(id)}/history/${historical}/restore`, { method: 'POST', ...json({ revision, requestId: crypto.randomUUID() }) }),
  },
  settings: {
    get: () => api<SharedBrand>('/api/workspace/settings'),
    save: (brand: BrandSettings, revision: number, requestId: string) => api<SharedBrand>('/api/workspace/settings', { method: 'PUT', ...json({ brand, revision, requestId }) }),
  },
  session: () => api<WorkspaceSession>('/api/session'),
  members: {
    list: () => api<WorkspaceMember[]>('/api/workspace/members'),
    add: (email: string, role: string, name: string) => api('/api/workspace/members', { method: 'POST', ...json({ email, role, name }) }),
    change: (id: string, patch: { role?: string; status?: string }) => api(`/api/workspace/members/${encodeURIComponent(id)}`, { method: 'PATCH', ...json(patch) }),
    remove: (id: string) => api(`/api/workspace/members/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    events: () => api<{ id: string; member_id: string; member_email: string | null; action: string; actor_email: string; previous_role: string | null; new_role: string | null; created_at: string }[]>('/api/workspace/members/events'),
  },
  presence: {
    list: () => api<PresenceEntry[]>('/api/workspace/presence'),
    heartbeat: (input: unknown) => api('/api/workspace/presence/heartbeat', { method: 'POST', ...json(input) }),
    leave: (input: unknown) => api('/api/workspace/presence/session', { method: 'DELETE', ...json(input) }),
  },
  assets: {
    list: async (q = '', category = '') => {
      const assets: MediaAsset[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api<MediaAsset[]>(`/api/assets?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&offset=${offset}`);
        assets.push(...page);
        if (page.length < 100) return [...new Map(assets.map(asset => [asset.id, asset])).values()];
      }
    },
    get: (id: string) => api<MediaAsset>(`/api/assets/${encodeURIComponent(id)}`),
    upload: (file: Blob, metadata: Partial<MediaAsset> & { fileName: string }) => api<MediaAsset>('/api/assets', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Asset-Metadata': encodeURIComponent(JSON.stringify(metadata)) }, body: file }),
    update: (id: string, patch: Partial<MediaAsset>) => api<MediaAsset>(`/api/assets/${encodeURIComponent(id)}`, { method: 'PATCH', ...json(patch), headers: { 'Content-Type': 'application/json', 'X-Resource-Revision': String(patch.revision ?? '') } }),
    remove: (id: string, revision?: number) => api<{ deleted: boolean }>(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Resource-Revision': String(revision ?? '') } }),
    usage: (id: string) => api<{ publications: { id: string }[]; materials: { id: string }[] }>(`/api/assets/${encodeURIComponent(id)}/usage`),
  },
  materials: {
    list: () => api<OnlineMaterial[]>('/api/materials'),
    get: (id: string) => api<OnlineMaterial>(`/api/materials/${encodeURIComponent(id)}`),
    save: (material: Partial<OnlineMaterial>) => api<OnlineMaterial>(material.id ? `/api/materials/${encodeURIComponent(material.id)}` : '/api/materials', { method: material.id ? 'PUT' : 'POST', ...json(material), headers: { 'Content-Type': 'application/json', 'X-Resource-Revision': String(material.revision ?? '') } }),
  },
  preflight: (input: PublicationInput) => api<PreflightResult & { html: string }>('/api/preflight', { method: 'POST', ...json(input) }),
  translate: (input: TranslationRequest) => api<TranslationResult>('/api/translate', { method: 'POST', ...json(input) }),
  versions: (campaignId: string) => api<EmailPublication[]>(`/api/publications?campaignId=${encodeURIComponent(campaignId)}`),
  publish: async (input: PublicationInput, key: string) => {
    const response = await fetch('/api/publications', { method: 'POST', ...json(input), headers: { ...editHeaders('campaign', input.campaign.id), 'Content-Type': 'application/json', 'Idempotency-Key': key } });
    const value = await response.json();
    if (response.status !== 422 && !response.ok) {
      if ([401, 403, 423].includes(response.status)) invalidateLease('campaign', input.campaign.id);
      throw new OnlineError(value.error || 'Publicação indisponível.', response.status);
    }
    return value as { publication: EmailPublication | null; preflight?: PreflightResult };
  },
};
export async function uploadLocalImage(uri: string, alt: string) {
  if (!uri.startsWith('data:image/')) throw new Error('Escolha uma imagem do computador.');
  const blob = await (await fetch(uri)).blob();
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[blob.type];
  if (!ext) throw new Error('O upload online aceita JPG, PNG e WebP sem animação.');
  return online.assets.upload(blob, { fileName: `imagem.${ext}`, name: alt || 'Imagem de campanha', alt });
}
