import type { Campaign, Language, RichNode } from '@/types/campaign';
import type { Section } from '@/types/design';
import { plainText, richText } from '@/campaigns/model';
import { sanitizeRichText } from './safety';

export type RichFields = Partial<Record<Language, Record<string, RichNode>>>;
export function fieldDocument(text: string, rich?: RichNode): RichNode {
  return rich && plainText(rich) === text ? sanitizeRichText(rich) : richText(text);
}
export function updateSectionText(section: Section, language: Language, field: string, value: RichNode): Section {
  const clean = sanitizeRichText(value);
  return { ...section, content: { ...section.content, [language]: { ...section.content[language], [field]: plainText(clean) } },
    ...(field === 'text' && section.richBody?.[language] ? { richBody: { ...section.richBody, [language]: clean } } : {}),
    richFields: { ...section.richFields, [language]: { ...section.richFields?.[language], [field]: clean } } };
}
export function updateLegacyText(campaign: Campaign, language: Language, field: string, value: RichNode): Partial<Campaign> {
  const clean = sanitizeRichText(value);
  if (field === 'body') return { content: { ...campaign.content, [language]: { ...campaign.content[language], body: clean } } };
  return { content: { ...campaign.content, [language]: { ...campaign.content[language], [field]: field === 'body' ? clean : plainText(clean) } },
    richFields: { ...campaign.richFields, [language]: { ...campaign.richFields?.[language], [field]: clean } } };
}

export interface LocalHistory<T> { past: T[]; present: T; future: T[]; group?: string; at: number }
export const historyOf = <T>(present: T): LocalHistory<T> => ({ past: [], present, future: [], at: 0 });
export function recordHistory<T>(history: LocalHistory<T>, next: T, group?: string, now = Date.now()): LocalHistory<T> {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  const merge = !!group && group === history.group && now - history.at < 800;
  return { past: merge ? history.past : [...history.past, history.present].slice(-80), present: next, future: [], group, at: now };
}
export function stepHistory<T>(h: LocalHistory<T>, redo = false): LocalHistory<T> {
  if (redo) return h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), at: 0 } : h;
  return h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], at: 0 } : h;
}

export function campaignFingerprint(c: Campaign): string {
  return JSON.stringify({ ...c, updatedAt: '', languageState: undefined, status: undefined });
}

// Two controls may finish in the same React batch (for example image decoding
// and ALT typing). Apply only the delta from the props that produced the patch.
export function mergeCampaignPatch(base: Campaign, current: Campaign, patch: Partial<Campaign>): Partial<Campaign> {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const merge = (before: unknown, latest: unknown, incoming: unknown): unknown => {
    if (JSON.stringify(before) === JSON.stringify(incoming)) return latest;
    if (Array.isArray(before) && Array.isArray(latest) && Array.isArray(incoming) && [...before, ...latest, ...incoming].every(item => record(item) && typeof item.id === 'string')) {
      const byId = (items: Record<string, unknown>[]) => new Map(items.map(item => [item.id, item]));
      const old = byId(before), now = byId(latest), next = byId(incoming);
      const reordered = JSON.stringify(before.map(item => item.id)) !== JSON.stringify(incoming.map(item => item.id));
      // A structural change must retain items added by another control in the
      // same batch, without resurrecting items that control already removed.
      const order = reordered
        ? [...incoming, ...latest.filter(item => !old.has(item.id) && !next.has(item.id))]
        : latest;
      return order.filter(item => !old.has(item.id) || (now.has(item.id) && next.has(item.id)))
        .map(item => next.has(item.id) ? merge(old.get(item.id), now.get(item.id), next.get(item.id)) : item);
    }
    if (record(incoming) && (before === undefined || record(before)) && (latest === undefined || record(latest))) {
      const result = { ...(latest ?? {}) };
      for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(incoming)])) {
        if (!Object.hasOwn(incoming, key)) delete result[key];
        else result[key] = merge(before?.[key], latest?.[key], incoming[key]);
      }
      return result;
    }
    return incoming;
  };
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, merge(base[key as keyof Campaign], current[key as keyof Campaign], value)])) as Partial<Campaign>;
}
// Hosting a local photo is an acknowledgement of the same edit. Rebase those
// references in the local history, so undo does not re-upload a hosted image.
export function rebaseHostedImages(history: LocalHistory<Campaign>, before: Campaign, after: Campaign): LocalHistory<Campaign> | undefined {
  const replacements = new Map<string, string>();
  const collect = (a: unknown, b: unknown) => {
    if (typeof a === 'string' && a.startsWith('data:image/') && typeof b === 'string' && b.startsWith('https://')) replacements.set(a, b);
    else if (a && b && typeof a === 'object' && typeof b === 'object') for (const key of Object.keys(a)) collect((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
  };
  collect(before, after);
  if (!replacements.size) return undefined;
  const replace = (value: unknown): unknown => typeof value === 'string' ? replacements.get(value) ?? value : Array.isArray(value) ? value.map(replace) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)])) : value;
  if (campaignFingerprint(replace(before) as Campaign) !== campaignFingerprint(after)) return undefined;
  return { ...history, past: history.past.map(c => replace(c) as Campaign), present: after, future: history.future.map(c => replace(c) as Campaign) };
}
