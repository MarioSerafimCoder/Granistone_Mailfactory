import type { CampaignContent, RichNode } from '@/types/campaign';
import type { TranslationItem, TranslationResult } from '@/types/online';

const textFields = [
  'subject', 'preheader', 'kicker', 'headline', 'subheadline', 'cta', 'heroAlt',
  'applicationAlt', 'materialName', 'features', 'applications', 'availability',
  'articleTitle', 'articleText', 'eventTitle', 'eventText', 'projectTitle', 'projectText',
] as const satisfies readonly (keyof CampaignContent)[];

function richItems(node: RichNode, path: number[] = []): TranslationItem[] {
  const own = typeof node.text === 'string' && node.text.trim()
    ? [{ id: `body.${path.join('.')}`, text: node.text }]
    : [];
  return own.concat(node.content?.flatMap((child, index) => richItems(child, [...path, index])) ?? []);
}

export function translationItems(source: CampaignContent): TranslationItem[] {
  const fields: TranslationItem[] = textFields
    .flatMap((field) => typeof source[field] === 'string' && source[field].trim()
      ? [{ id: field, text: source[field] as string }]
      : []);
  return [...fields, ...richItems(source.body)];
}

function translateRich(node: RichNode, path: number[], translated: Map<string, string>): RichNode {
  return {
    ...node,
    ...(typeof node.text === 'string' ? { text: translated.get(`body.${path.join('.')}`) ?? node.text } : {}),
    ...(node.content ? { content: node.content.map((child, index) => translateRich(child, [...path, index], translated)) } : {}),
  };
}

export function applyTranslation(
  source: CampaignContent,
  current: CampaignContent,
  result: TranslationResult,
): CampaignContent {
  const translated = new Map(result.items.map((item) => [item.id, item.text]));
  const next = { ...current };
  for (const field of textFields) {
    const value = translated.get(field);
    if (value !== undefined) (next[field] as string) = value;
  }
  next.body = translateRich(source.body, [], translated);
  next.ctaUrl = source.ctaUrl;
  next.articleUrl = source.articleUrl;
  next.heroImage = source.heroImage;
  next.applicationImage = source.applicationImage;
  return next;
}
