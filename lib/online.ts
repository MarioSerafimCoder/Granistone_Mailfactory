import type { EmailPublication, MediaAsset, OnlineMaterial, PreflightResult, PublicationInput, TranslationRequest, TranslationResult } from '@/types/online';
import type { Campaign, BrandSettings } from '@/types/campaign';
import type { SharedCampaign, SharedBrand, CampaignRevision } from '@/types/workspace';
export class OnlineError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, credentials: 'same-origin' });
  let value;
  try { value = await response.json(); } catch { throw new OnlineError('Servidor online indisponível neste endereço.', response.status); }
  if (!response.ok) throw new OnlineError(value.error || 'A operação não foi concluída.', response.status);
  return value as T;
}
const json = (value: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const online = {
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
  session: () => api<{ editor: boolean; email: string; origin: string }>('/api/session'),
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
    update: (id: string, patch: Partial<MediaAsset>) => api<MediaAsset>(`/api/assets/${encodeURIComponent(id)}`, { method: 'PATCH', ...json(patch) }),
    remove: (id: string) => api<{ deleted: boolean }>(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    usage: (id: string) => api<{ publications: { id: string }[]; materials: { id: string }[] }>(`/api/assets/${encodeURIComponent(id)}/usage`),
  },
  materials: {
    list: () => api<OnlineMaterial[]>('/api/materials'),
    get: (id: string) => api<OnlineMaterial>(`/api/materials/${encodeURIComponent(id)}`),
    save: (material: Partial<OnlineMaterial>) => api<OnlineMaterial>(material.id ? `/api/materials/${encodeURIComponent(material.id)}` : '/api/materials', { method: material.id ? 'PUT' : 'POST', ...json(material) }),
  },
  preflight: (input: PublicationInput) => api<PreflightResult & { html: string }>('/api/preflight', { method: 'POST', ...json(input) }),
  translate: (input: TranslationRequest) => api<TranslationResult>('/api/translate', { method: 'POST', ...json(input) }),
  versions: (campaignId: string) => api<EmailPublication[]>(`/api/publications?campaignId=${encodeURIComponent(campaignId)}`),
  publish: async (input: PublicationInput, key: string) => {
    const response = await fetch('/api/publications', { method: 'POST', ...json(input), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key } });
    const value = await response.json();
    if (response.status !== 422 && !response.ok) throw new OnlineError(value.error || 'Publicação indisponível.', response.status);
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
