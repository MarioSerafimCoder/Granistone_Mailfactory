import type { RichNode } from '@/types/campaign';
import { plainText } from '@/campaigns/model';
import { escapeHtml as e, sanitizeRichText } from '@/lib/safety';

// Only explicitly registered display text is substituted, never URLs or attributes.
// Untouched documents produce byte-for-byte identical display markup.
export function prepareRichFields<T extends object>(content: T, fields: Record<string, RichNode> | undefined, allowed: string[], lineFields: string[] = []) {
  const copy = { ...content };
  const replacements: [string, string][] = [];
  let prefix = 'GRANISTONE_RICH_';
  while (JSON.stringify([content, fields]).includes(prefix)) prefix += 'X';
  for (const field of allowed) {
    const doc = fields?.[field];
    const value = content[field as keyof T];
    if (!doc || typeof value !== 'string' || plainText(doc) !== value || !value) continue;
    const documents = lineFields.includes(field) ? (doc.content ?? []).map(node => ({ type: 'doc', content: [node] })) : [doc];
    copy[field as keyof T] = documents.map(document => {
      const token = `${prefix}${replacements.length}_END`;
      replacements.push([token, renderInlineDocument(document, !['label', 'label2', 'cta', 'articleTitle'].includes(field))]);
      return token;
    }).join('\n') as T[keyof T];
  }
  return { content: copy, finish: (html: string) => replacements.reduce((result, [token, value]) => result.split(token).join(value), html) };
}
export function renderInlineDocument(value: RichNode, links = true): string {
  const render = (node: RichNode): string => {
    if (node.type === 'hardBreak') return '<br/>';
    if (node.type === 'text') return (node.marks ?? []).reduce((html, mark) => {
      if (mark.type === 'link' && links) return `<a href="${e(mark.attrs?.href)}" target="_blank">${html}</a>`;
      const tag = { bold: 'strong', italic: 'em', underline: 'u' }[mark.type];
      return tag ? `<${tag}>${html}</${tag}>` : html;
    }, e(node.text));
    const inner = (node.content ?? []).map(render).join('');
    if (node.type === 'paragraph') return `<span style="display:block;${node.attrs?.textAlign ? `text-align:${node.attrs.textAlign}` : ''}">${inner || '<br/>'}</span>`;
    return inner;
  };
  return render(sanitizeRichText(value));
}
