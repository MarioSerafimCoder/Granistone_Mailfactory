import type { CampaignContent, RichNode, Campaign, Language } from '@/types/campaign';
import { blockRegistry } from '@/blocks/registry';
import type { TranslationItem, TranslationResult } from '@/types/online';

const textFields = [
  'subject', 'preheader', 'kicker', 'headline', 'subheadline', 'cta', 'heroAlt',
  'applicationAlt', 'materialName', 'features', 'applications', 'availability',
  'articleTitle', 'articleText', 'eventTitle', 'eventText', 'projectTitle', 'projectText',
] as const satisfies readonly (keyof CampaignContent)[];

export function richItems(node: RichNode, path: number[] = []): TranslationItem[] {
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

export function translateRich(node: RichNode, path: number[], translated: Map<string, string>): RichNode {
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
export function sectionTranslationItems(campaign: Campaign, language: Language): TranslationItem[] {
  return (campaign.sections ?? []).flatMap((section, index) => [
    ...blockRegistry[section.type].fields.filter(f => !['image', 'url'].includes(f.kind) && !(f.key === 'text' && section.richBody?.[language])).flatMap(f => section.content[language][f.key]?.trim() ? [{ id: `section.${index}.${f.key}`, text: section.content[language][f.key] }] : []),
    ...(section.richBody?.[language] ? richItems(section.richBody[language]).map(item => ({ ...item, id: `section.${index}.${item.id}` })) : []),
  ]);
}
export function applySectionTranslation(campaign: Campaign, target: 'en' | 'es', result: TranslationResult, replace: boolean) {
  const translated = new Map(result.items.map(item => [item.id, item.text]));
  return campaign.sections?.map((section, index) => {
    const next = structuredClone(section);
    for (const field of blockRegistry[section.type].fields) {
      if (['image', 'url'].includes(field.kind)) next.content[target][field.key] = section.content.pt[field.key];
      else if (replace || !next.content[target][field.key].trim()) next.content[target][field.key] = translated.get(`section.${index}.${field.key}`) ?? next.content[target][field.key];
    }
    if (section.richBody?.pt && (replace || !section.richBody[target])) next.richBody = { ...next.richBody, [target]: translateRich(section.richBody.pt, [], new Map(result.items.filter(item => item.id.startsWith(`section.${index}.body.`)).map(item => [item.id.slice(`section.${index}.`.length), item.text]))) };
    return next;
  });
}
