import type { Campaign, Language } from '@/types/campaign';

export function downloadFile(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fileName = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'campanha';

export function campaignFileName(campaign: Campaign, language: Language) {
  const audience = fileName(campaign.audience || 'publico');
  return `granistone-${fileName(campaign.title)}-${audience}-${language}`;
}
