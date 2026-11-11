import { uploadLocalImage } from './online';
type Upload = (uri: string, alt: string) => Promise<{ url: string }>;
export function hasLocalImages(input: unknown): boolean {
  if (typeof input === 'string') return /^(data:image\/|blob:)/i.test(input);
  return !!input && typeof input === 'object' && Object.values(input).some(hasLocalImages);
}

// Rebase an upload acknowledgement onto ongoing edits without restoring the
// snapshot's text, order, removed blocks, or a subsequently replaced image.
export function mergeHostedImages<T>(current: T, source: T, hosted: T): T {
  const replacements = new Map<string, string>();
  const collect = (before: unknown, after: unknown) => {
    if (typeof before === 'string' && before.startsWith('data:image/') && typeof after === 'string' && after !== before) replacements.set(before, after);
    else if (before && after && typeof before === 'object' && typeof after === 'object') {
      for (const key of Object.keys(before)) collect((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]);
    }
  };
  collect(source, hosted);
  const walk = (value: unknown): unknown => typeof value === 'string' ? replacements.get(value) ?? value : Array.isArray(value) ? value.map(walk) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)])) : value;
  return walk(current) as T;
}
export async function hostLocalImages<T extends object>(input: T, upload: Upload = uploadLocalImage): Promise<T> {
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
