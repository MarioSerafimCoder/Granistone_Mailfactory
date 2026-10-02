import type { BrandSettings, Campaign } from './campaign';
export interface SharedCampaign {
  campaign: Campaign; revision: number; createdAt: string; createdBy: string;
  updatedAt: string; updatedBy: string; deletedAt: string | null; deletedBy: string | null;
}
export interface SharedBrand { brand: BrandSettings; revision: number; updatedAt: string; updatedBy: string }
export interface CampaignRevision { revision: number; campaign: Campaign; changedBy: string; createdAt: string; reason: string }
export interface PendingChange { revision: number; operation: 'save' | 'delete'; requestId: string; sent?: { operation: 'save' | 'delete'; campaign?: Campaign } }
export interface SyncMetadata {
  revisions: Record<string, number>;
  pending: Record<string, PendingChange>;
  conflicts: Record<string, string>;
  brandRevision: number;
  brandPending?: string;
  brandSent?: BrandSettings;
  localBrand?: BrandSettings;
  brandConflict?: string;
  initialized: boolean;
  trash: Campaign[];
}
