import type { PublicationInput, PreflightCheck } from '@/types/online';
import { isCampaign, isBrand } from '@/lib/storage';
import { publicHttpsUrl } from '@/lib/public-url';
import { renderEmail } from '@/export/render';
import { contentChecks, htmlChecks, result, preflightLimits } from '@/export/preflight';
import { AssetRepository } from './assets';
import { inspectRemote } from './remote';
import { HttpError, type Env } from './platform';
export function publicationInput(raw: unknown): PublicationInput {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Campanha inválida.');
  const value = raw as PublicationInput;
  if (!isCampaign(value.campaign) || !isBrand(value.brand) || !['pt', 'en', 'es'].includes(value.language) || value.campaign.id.length > 100)
    throw new HttpError(400, 'Campanha, marca ou idioma inválido.');
  return value;
}
export function imageUrls(html: string) {
  return [...new Set([...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/gi)].map(m => m[1].replace(/&amp;/g, '&')))];
}
export async function runPreflight(input: PublicationInput, env: Env) {
  const html = await renderEmail(input.campaign, input.language, input.brand);
  const checks = [...contentChecks(input.campaign, input.language, input.brand), ...htmlChecks(html)];
  const assets = new AssetRepository(env);
  const policy = { hosts: (env.REMOTE_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean) };
  const images = imageUrls(html);
  const links = [...new Set([...html.matchAll(/\bhref="([^"]*)"/gi)].map(m => m[1].replace(/&amp;/g, '&')).filter(publicHttpsUrl))];
  if (images.length + links.length > 40) throw new HttpError(400, 'Limite de 40 recursos por e-mail.');
  for (const [kind, urls] of [['images', images], ['links', links]] as const) {
    for (const url of urls) {
      if (!publicHttpsUrl(url)) continue; // Already reported by content/HTML validation.
      const id = `remote.${kind}.${checks.length}`;
      try {
        const parsed = new URL(url);
        let size: number | null = null; let mime = ''; let width: number | undefined; let height: number | undefined;
        if (parsed.origin === env.SITE_ORIGIN) {
          if (kind === 'images' && /^\/assets\/[a-f0-9]{64}$/.test(parsed.pathname)) {
            const asset = await assets.get(parsed.pathname.split('/')[2]);
            const row = await assets.row(asset.id);
            if (!row || !await env.BUCKET.head(row.object_key)) throw new Error('Arquivo ausente.');
            size = asset.fileSize; mime = asset.mimeType; width = asset.width; height = asset.height;
          } else if (kind === 'images' && /^\/brand\/[a-z0-9_.-]+$/.test(parsed.pathname)) {
            const response = await env.ASSETS.fetch(new Request(url, { method: 'HEAD' }) as never);
            if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Imagem da marca indisponível.');
            size = Number(response.headers.get('content-length')) || null;
          } else if (kind === 'links') {
            checks.push({ id, category: kind, severity: 'warning', message: `Link interno requer conferência manual: ${parsed.pathname}` }); continue;
          } else throw new Error('Rota de imagem não reconhecida.');
        } else {
          const remote = await inspectRemote(url, policy, kind === 'images'); size = remote.fileSize; mime = remote.mimeType;
        }
        checks.push({ id, category: kind, severity: 'pass', message: `Acessível: ${url}` });
        if (kind === 'images') {
          const warning = (suffix: string, message: string) => checks.push({ id: id + suffix, category: kind, severity: 'warning', message } as PreflightCheck);
          if (size && size > preflightLimits.imageBytes) warning('.size', `Imagem acima de 500 KB: ${url}`);
          if (mime === 'image/webp' || mime === 'image/gif') warning('.format', `Formato exige teste nos clientes de e-mail: ${mime}.`);
          const isHero = url === input.campaign.content[input.language].heroImage;
          if (width && isHero && width < 600) warning('.dimensions', 'Imagem principal abaixo de 600 px de largura.');
          if (width && height && isHero && height > width * 1.5 && input.campaign.template !== 'product-commercial') warning('.orientation', 'Imagem vertical em área predominantemente horizontal.');
          if (!width) warning('.unknownDimensions', 'Dimensões externas não confirmadas; importe ao catálogo para análise completa.');
          if (parsed.origin !== env.SITE_ORIGIN) warning('.external', 'Imagem externa pode mudar fora do Studio. Use o catálogo para retenção garantida.');
        }
      } catch (error) {
        checks.push({ id, category: kind, severity: kind === 'images' ? 'error' : 'warning', message: `${url}: ${error instanceof Error ? error.message : 'Verificação indisponível.'}` });
      }
    }
  }
  return { ...result(checks), html };
}
