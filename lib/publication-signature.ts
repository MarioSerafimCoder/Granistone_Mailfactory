import type { PublicationInput } from '@/types/online';
export function publicationSignature({ campaign, language, brand }: PublicationInput) {
  // A stable signature describes rendered content, not another language's status.
  const value = { content: campaign.content[language], template: campaign.template, blocks: campaign.blocks, alignment: campaign.alignment, brand };
  const stable = (item: unknown): unknown => Array.isArray(item) ? item.map(stable) : item && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, stable(val)])) : item;
  return JSON.stringify(stable(value));
}
