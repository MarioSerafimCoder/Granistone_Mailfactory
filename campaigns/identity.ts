import type { Campaign, CampaignType } from '@/types/campaign';

const identityPart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export function campaignSourceKey(input: {
  date: string;
  title: string;
  audience: string;
  language: string;
  campaignType: CampaignType;
}): string {
  return [input.date, input.title, input.audience, input.language, input.campaignType]
    .map(identityPart)
    .join('|');
}

export function stableImportId(sourceKey: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceKey.length; index += 1) {
    hash ^= sourceKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `xlsx-${(hash >>> 0).toString(36)}`;
}

export function campaignFingerprint(campaign: Campaign): string {
  return campaign.sourceKey || campaignSourceKey(campaign);
}
