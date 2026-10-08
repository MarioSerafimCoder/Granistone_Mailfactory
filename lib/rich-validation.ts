import type { RichNode } from '@/types/campaign';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validRichFields(value: unknown, allowed: string[]): boolean {
  return value === undefined || (record(value) && Object.entries(value).every(([lang, fields]) =>
    ['pt', 'en', 'es'].includes(lang) && record(fields) && Object.entries(fields).every(([key, doc]) => allowed.includes(key) && validRich(doc))));
}
export function validRich(value: unknown, depth = 0): value is RichNode {
  return depth < 25 && record(value) && typeof value.type === 'string' && (value.text === undefined || typeof value.text === 'string') &&
    (value.content === undefined || (Array.isArray(value.content) && value.content.length <= 500 && value.content.every(node => validRich(node, depth + 1)))) &&
    (value.marks === undefined || (Array.isArray(value.marks) && value.marks.every(mark => record(mark) && typeof mark.type === 'string' && (!mark.attrs || record(mark.attrs)))));
}
