import type { EmailPublication, MediaAsset, OnlineMaterial, PreflightResult, PublicationInput } from '@/types/online';
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
  session: () => api<{ editor: boolean; email: string; origin: string }>('/api/session'),
  assets: {
    list: (q = '', category = '') => api<MediaAsset[]>(`/api/assets?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
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
