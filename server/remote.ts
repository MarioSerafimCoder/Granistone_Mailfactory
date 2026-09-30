import { publicAddress, publicHttpsUrl } from '@/lib/public-url';
import { HttpError } from './platform';

export interface RemotePolicy { hosts: string[]; fetcher?: typeof fetch }
/** Exact, operator-approved hosts only. No wildcard/user supplied trust expansion.
 * DNS checks supplement this boundary; an arbitrary attacker-controlled hostname
 * is never fetched, even when its first DNS answer is public (DNS rebinding).
 */
export async function inspectRemote(input: string, policy: RemotePolicy, image = false) {
  const fetcher = policy.fetcher ?? fetch;
  const signal = AbortSignal.timeout(6000);
  let url = input;
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!publicHttpsUrl(url)) throw new HttpError(400, 'URL não pública ou insegura.');
    const parsed = new URL(url);
    if (!policy.hosts.includes(parsed.hostname)) throw new HttpError(400, 'Domínio não autorizado para consulta remota. Envie a imagem ao catálogo ou solicite autorização do domínio.');
    for (const type of ['A', 'AAAA']) {
      const dns = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(parsed.hostname)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal, redirect: 'error' });
      if (!dns.ok) throw new Error('Não foi possível verificar o DNS.');
      const data = await dns.json() as { Status: number; Answer?: { type: number; data: string }[] };
      if (data.Status !== 0 || data.Answer?.some(a => [1, 28].includes(a.type) && !publicAddress(a.data))) throw new HttpError(400, 'DNS privado ou inválido.');
      if (type === 'A' && !data.Answer?.some(a => a.type === 1)) throw new HttpError(400, 'DNS público não confirmado.');
    }
    let response = await fetcher(url, { method: 'HEAD', redirect: 'manual', signal, credentials: 'omit' });
    if ([403, 405, 501].includes(response.status) || (response.ok && image && !response.headers.get('content-type'))) {
      await response.body?.cancel();
      response = await fetcher(url, { method: 'GET', headers: { Range: 'bytes=0-65535' }, redirect: 'manual', signal, credentials: 'omit' });
    }
    const status = response.status; const headers = response.headers;
    // A fallback never downloads an unbounded response body.
    await response.body?.cancel();
    if ([301, 302, 303, 307, 308].includes(status)) {
      if (!headers.get('location') || redirects === 3) throw new HttpError(400, 'Limite de redirecionamentos excedido.');
      url = new URL(headers.get('location')!, url).href; continue;
    }
    if (status < 200 || status >= 300) throw new Error(`Recurso inacessível (HTTP ${status}).`);
    const mimeType = (headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (image && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) throw new Error('O endereço não retornou uma imagem suportada.');
    const rangeSize = headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
    return { url, mimeType, fileSize: Number(rangeSize || headers.get('content-length')) || null };
  }
  throw new Error('Redirecionamento inválido.');
}
