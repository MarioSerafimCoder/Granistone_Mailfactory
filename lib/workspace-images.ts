import type { Campaign, BrandSettings } from '@/types/campaign';
import { uploadLocalImage } from './online';
type Upload = (uri: string, alt: string) => Promise<{ url: string }>;
export async function hostLocalImages<T extends Campaign | BrandSettings>(input: T, upload: Upload = uploadLocalImage): Promise<T> {
  const uploads = new Map<string, Promise<string>>();
  async function walk(value: unknown): Promise<unknown> {
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      if (!uploads.has(value)) uploads.set(value, upload(value, 'Imagem da campanha').then(asset => asset.url));
      return uploads.get(value);
    }
    if (typeof value === 'string' && /^(data|blob):/i.test(value)) throw new Error('Escolha novamente a imagem local para hospedá-la.');
    if (Array.isArray(value)) return Promise.all(value.map(walk));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await walk(item)])));
    return value;
  }
  return await walk(input) as T;
}
