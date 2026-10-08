import type { RichNode } from '@/types/campaign';
export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function safeUrl(value: string, image = false): string {
  const v = value.trim();
  if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(v)) return v;
  if (image && /^\/brand\/[a-z\d\-_.]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    if (['https:', 'http:', ...(!image ? ['mailto:', 'tel:'] : [])].includes(u.protocol)) return v;
  } catch {
    /* invalid input is not a URL */
  }
  return '';
}
export const isPublicUrl = (v: string) => {
  try {
    const u = new URL(v);
    return (
      u.protocol === 'https:' &&
      !/^(localhost|127\.|0\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(u.hostname)
    );
  } catch {
    return false;
  }
};
const nodeTypes = new Set([
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
]);
export function hasRestrictedFormatting(node: RichNode): boolean {
  return (
    !nodeTypes.has(node.type) ||
    (node.type === 'paragraph' && node.attrs?.textAlign !== undefined && !['left', 'center', 'right', null].includes(node.attrs.textAlign as string)) ||
    !!node.marks?.some((m) => !['bold', 'italic', 'underline', 'link'].includes(m.type)) ||
    !!node.content?.some(hasRestrictedFormatting)
  );
}
export function sanitizeRichText(node: RichNode, depth = 0): RichNode {
  if (node && ['heading', 'codeBlock', 'footer'].includes(node.type))
    node = { ...node, type: 'paragraph' };
  if (depth > 20 || !node || !nodeTypes.has(node.type)) return { type: 'paragraph', content: [] };
  return {
    type: node.type,
    ...(node.type === 'text' ? { text: String(node.text ?? '') } : {}),
    ...(node.type === 'paragraph' && ['left', 'center', 'right'].includes(String(node.attrs?.textAlign))
      ? { attrs: { textAlign: node.attrs?.textAlign } } : {}),
    ...(node.marks
      ? {
          marks: node.marks
            .filter((m) => ['bold', 'italic', 'underline', 'link'].includes(m.type))
            .flatMap((m) =>
              m.type === 'link'
                ? safeUrl(String(m.attrs?.href ?? ''))
                  ? [
                      {
                        type: 'link',
                        attrs: { href: safeUrl(String(m.attrs?.href)), target: '_blank' },
                      },
                    ]
                  : []
                : [{ type: m.type }],
            ),
        }
      : {}),
    ...(node.content
      ? { content: node.content.slice(0, 500).map((n) => sanitizeRichText(n, depth + 1)) }
      : {}),
  };
}
