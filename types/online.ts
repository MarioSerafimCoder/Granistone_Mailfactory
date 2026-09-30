import type { Campaign, BrandSettings, Language, StoneMaterial } from './campaign';

export const assetCategories = ['material', 'ambiente', 'chapa', 'detalhe', 'institucional', 'evento', 'outro'] as const;
export interface MediaAsset {
  id: string; name: string; fileName: string; mimeType: string;
  width: number; height: number; fileSize: number; url: string;
  category: typeof assetCategories[number]; materialId?: string;
  orientation: 'horizontal' | 'vertical' | 'square'; alt: string;
  createdAt: string; updatedAt: string;
}
export interface OnlineMaterial extends Omit<StoneMaterial, 'images' | 'heroImage' | 'slabImage'> {
  pageUrl: string; active: boolean; heroAssetId?: string; slabAssetId?: string;
  applicationAssetId?: string; assetIds: string[];
}
export interface PreflightCheck {
  id: string; category: 'content' | 'images' | 'links' | 'compatibility';
  severity: 'pass' | 'warning' | 'error'; message: string;
}
export interface PreflightResult {
  checks: PreflightCheck[]; hasErrors: boolean; warnings: PreflightCheck[];
}
export interface PublicationInput { campaign: Campaign; brand: BrandSettings; language: Language }
export interface EmailPublication {
  id: string; campaignId: string; language: Language; slug: string; version: number;
  html: string; publishedAt: string; url: string; latestUrl: string;
}
export interface TranslationItem { id: string; text: string }
export interface TranslationRequest { target: 'en' | 'es'; items: TranslationItem[] }
export interface TranslationResult { target: 'en' | 'es'; items: TranslationItem[] }
