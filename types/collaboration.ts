export type MemberRole = 'admin' | 'editor' | 'viewer';
export interface WorkspaceSession {
  authenticated: boolean; member: boolean; editor: boolean; email: string; name: string;
  role: MemberRole | null; owner: boolean; origin: string;
  permissions: { editCampaigns: boolean; publish: boolean; manageMembers: boolean; editBrand: boolean };
}
export interface WorkspaceMember {
  id: string; email: string; name: string; role: MemberRole; status: 'active' | 'disabled';
  created_at: string; last_seen_at: string | null; owner?: boolean;
}
export type ResourceType = 'campaign' | 'material' | 'asset' | 'brand' | 'design';
export interface PresenceEntry {
  userId: string; name: string; email: string; tabId: string; location: string;
  resourceType: ResourceType | ''; resourceId: string; resourceName: string;
  state: 'online' | 'away'; editing: boolean;
}
export interface EditLock {
  resourceType: ResourceType; resourceId: string; token: string; generation: number;
  sessionId: string; tabId: string; expiresAt: number;
}
