import ipaddr from 'ipaddr.js';
export function publicAddress(address: string): boolean {
  try { return ipaddr.parse(address.replace(/^\[|\]$/g, '')).range() === 'unicast'; }
  catch { return false; }
}
export function publicHttpsUrl(value: string): boolean {
  try {
    if (/[\s\\\u0000-\u001f]/.test(value) || value.length > 2048) return false;
    const u = new URL(value); const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
    if (ipaddr.isValid(host.replace(/^\[|\]$/g, ''))) return publicAddress(host);
    return host.includes('.') && !host.endsWith('.') && !/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host) && /^[a-z0-9.-]+$/.test(host);
  } catch { return false; }
}
