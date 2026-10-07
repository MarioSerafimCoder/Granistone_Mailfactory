import type { Campaign, Language, TemplateId } from './campaign';
export type Background = { kind: 'solid'; color: string } | { kind: 'gradient'; start: string; end: string; direction: 'vertical' | 'horizontal' | 'diagonal'; fallback: string } | { kind: 'image'; image: string; size: 'cover' | 'contain'; position: 'center' | 'top' | 'bottom'; fallback: string; overlay: number } | { kind: 'preset'; preset: string };
export type SectionType = 'heroEditorial' | 'heroProduct' | 'imageText' | 'textImage' | 'centeredText' | 'product' | 'twoProducts' | 'gallery' | 'specifications' | 'applications' | 'quote' | 'cta' | 'divider' | 'spacer' | 'banner' | 'complementaryFooter';
export interface Section {
  richBody?: Partial<Record<Language, import('./campaign').RichNode>>;
  id: string; type: SectionType; enabled: boolean;
  content: Record<Language, Record<string, string>>;
  settings: { background: Background; textColor: string; padding: number; alignment: 'left' | 'center'; height: number };
}
export interface CampaignDesign { email: Background; content: Background; textColor: string }
export interface Blueprint { template: TemplateId; sections: Section[]; design: CampaignDesign; alignment: Campaign['alignment']; language: Campaign['language'] }
export type SavedDesign = { id: string; name: string; description: string; category: string; revision: number; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string } & ({ kind: 'block'; payload: Section } | { kind: 'template'; payload: Blueprint });
export type DesignInput = Pick<SavedDesign, 'id' | 'name' | 'description' | 'category' | 'revision'> & ({ kind: 'block'; payload: Section } | { kind: 'template'; payload: Blueprint });
