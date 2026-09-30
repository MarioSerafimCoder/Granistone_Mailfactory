import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import { contentChecks } from './preflight';
export function exportIssues(c: Campaign, lang: Language, brand: BrandSettings): string[] {
  return contentChecks(c, lang, brand).filter(c => c.severity === 'error').map(c => c.message);
}
