import type { SharedCampaign, SyncMetadata } from '@/types/workspace';
import type { StudioData } from './storage';
import { online, OnlineError } from './online';
import { hostLocalImages } from './workspace-images';
import { defaultBrand } from '@/data/brand';
export type SaveState = 'loading' | 'saving' | 'saved' | 'local' | 'offline' | 'conflict' | 'error';
export const saveLabels: Record<SaveState, string> = { loading: 'Abrindo workspace…', saving: 'Salvando…', saved: 'Salvo na nuvem', local: 'Salvo localmente · ainda não compartilhado', offline: 'Sem conexão · alterações pendentes', conflict: 'Conflito de edição', error: 'Erro ao sincronizar' };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const initialSync = (): SyncMetadata => ({ revisions: {}, pending: {}, conflicts: {}, activity: {}, conflictDetails: {}, brandRevision: 0, initialized: false, trash: [] });
type Api = Pick<typeof online, 'campaigns' | 'settings' | 'session'>;
export class WorkspaceSync {
  data: StudioData;
  editor = false;
  state: SaveState = 'loading';
  error = '';
  busy = false;
  brandEditing = false;
  private stopped = false;
  constructor(data: StudioData, private persist: (data: StudioData) => Promise<void>, private notify: () => void, private api: Api = online, private images = hostLocalImages) {
    this.data = { ...data, sync: data.sync ?? initialSync() };
  }
  get meta() { return this.data.sync!; }
  get localCampaigns() { return this.data.campaigns.filter(c => !this.meta.revisions[c.id] && !this.meta.pending[c.id]); }
  stop() { this.stopped = true; }
  setBrandEditing(editing: boolean) { this.brandEditing = editing; }
  private async commit() {
    this.data = structuredClone(this.data);
    this.notify();
    await this.persist(this.data);
  }
  private settle() {
    this.state = Object.keys(this.meta.conflicts).length || this.meta.brandConflict ? 'conflict'
      : Object.keys(this.meta.pending).length || this.meta.brandPending ? this.editor ? 'saving' : 'offline'
      : this.editor && !this.localCampaigns.length ? 'saved' : 'local';
    this.notify();
  }
  save(next: StudioData) {
    const meta = structuredClone(this.meta);
    for (const campaign of next.campaigns) {
      const before = this.data.campaigns.find(c => c.id === campaign.id);
      if (!equal(before, campaign) && (meta.revisions[campaign.id] || meta.pending[campaign.id] || (!before && this.editor))) {
        meta.pending[campaign.id] = { ...meta.pending[campaign.id], revision: meta.pending[campaign.id]?.revision ?? meta.revisions[campaign.id] ?? 0, operation: 'save', requestId: meta.pending[campaign.id]?.requestId ?? crypto.randomUUID() };
      }
    }
    for (const old of this.data.campaigns) if (!next.campaigns.some(c => c.id === old.id)) {
      meta.trash = [...meta.trash.filter(c => c.id !== old.id), old];
      if (meta.revisions[old.id] || meta.pending[old.id]) meta.pending[old.id] = { ...meta.pending[old.id], revision: meta.pending[old.id]?.revision ?? meta.revisions[old.id], operation: 'delete', requestId: meta.pending[old.id]?.requestId ?? crypto.randomUUID() };
    }
    if (!equal(next.brand, this.data.brand) && (this.editor || meta.initialized)) meta.brandPending ??= crypto.randomUUID();
    this.data = { ...next, sync: meta };
    this.error = ''; this.settle();
    return this.commit();
  }
  async refresh() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      const session = await this.api.session(); this.editor = session.editor;
      if (!this.editor) { this.settle(); return; }
      const [rows, settings] = await Promise.all([this.api.campaigns.list(), this.api.settings.get()]);
      if (this.stopped) return;
      for (const row of rows) {
        const id = row.campaign.id;
        if (this.meta.pending[id] || this.meta.conflicts[id]) continue;
        const local = this.data.campaigns.find(c => c.id === id);
        if (local && !this.meta.revisions[id] && !equal(local, row.campaign)) {
          this.meta.conflicts[id] = 'Já existe uma campanha com este ID no workspace. Seu rascunho local foi preservado.';
          this.meta.conflictDetails ??= {};
          this.meta.conflictDetails[id] = { updatedAt: row.updatedAt, updatedBy: row.updatedBy };
          this.meta.revisions[id] = row.revision;
          continue;
        }
        this.accept(row);
      }
      if (!this.meta.brandPending && !this.meta.brandConflict && !this.brandEditing) {
        if (!this.meta.initialized && !equal(this.data.brand, defaultBrand)) this.meta.localBrand = this.data.brand;
        this.meta.brandRevision = settings.revision;
        if (settings.revision || !this.meta.localBrand) this.data.brand = settings.brand;
      }
      this.meta.initialized = true;
      this.error = ''; this.settle(); await this.commit();
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }
  private accept(row: SharedCampaign) {
    const id = row.campaign.id;
    this.meta.revisions[id] = row.revision;
    this.meta.activity ??= {};
    this.meta.activity[id] = { updatedAt: row.updatedAt, updatedBy: row.updatedBy, deletedAt: row.deletedAt, deletedBy: row.deletedBy };
    this.data.campaigns = this.data.campaigns.filter(c => c.id !== id);
    this.meta.trash = this.meta.trash.filter(c => c.id !== id);
    if (row.deletedAt) this.meta.trash.push(row.campaign); else this.data.campaigns.push(row.campaign);
  }
  private fail(error: unknown) {
    this.error = error instanceof Error ? error.message : 'Não foi possível sincronizar.';
    if (error instanceof OnlineError && [401, 403].includes(error.status)) this.editor = false;
    this.state = error instanceof TypeError ? 'offline' : 'error'; this.notify();
  }
  async sync() {
    if (this.busy || !this.editor || this.stopped) return;
    this.busy = true;
    try {
      for (const id of Object.keys(this.meta.pending)) {
        if (this.stopped) return;
        if (this.meta.conflicts[id]) continue;
        let pending = this.meta.pending[id];
        const current = this.data.campaigns.find(c => c.id === id);
        if (!pending.sent) {
          if (pending.operation === 'delete' && !pending.revision) { delete this.meta.pending[id]; continue; }
          const snapshot = current;
          const hosted = pending.operation === 'save' ? await this.images(snapshot!) : undefined;
          // Keep typing during uploads; only replace the exact snapshot uploaded.
          pending = this.meta.pending[id];
          pending.sent = { operation: hosted ? 'save' : 'delete', campaign: hosted };
          if (hosted && equal(this.data.campaigns.find(c => c.id === id), snapshot)) this.data.campaigns = this.data.campaigns.map(c => c.id === id ? hosted : c);
          await this.commit();
          pending = this.meta.pending[id];
        }
        const sent = pending.sent!;
        try {
          const row = sent.operation === 'delete' ? await this.api.campaigns.remove(id, pending.revision, pending.requestId)
            : pending.revision ? await this.api.campaigns.save(sent.campaign!, pending.revision, pending.requestId)
            : await this.api.campaigns.create(sent.campaign!, pending.requestId);
          const live = this.data.campaigns.find(c => c.id === id);
          const unchanged = sent.operation === 'delete' ? !live : equal(live, sent.campaign);
          if (unchanged) { this.accept(row); delete this.meta.pending[id]; }
          else {
            this.meta.revisions[id] = row.revision;
            this.meta.pending[id] = { revision: row.revision, operation: live ? 'save' : 'delete', requestId: crypto.randomUUID() };
          }
          await this.commit();
        } catch (error) {
          if (error instanceof OnlineError && error.status === 409) {
            this.meta.conflicts[id] = error.message;
            try {
              const remote = await this.api.campaigns.get(id);
              this.meta.conflictDetails ??= {};
              this.meta.conflictDetails[id] = { updatedAt: remote.updatedAt, updatedBy: remote.updatedBy };
            } catch { /* The conflict remains actionable if remote details are temporarily unavailable. */ }
            await this.commit();
          }
          else throw error;
        }
      }
      if (this.meta.brandPending && !this.meta.brandConflict) {
        if (!this.meta.brandSent) {
          const snapshot = this.data.brand;
          const hosted = await this.images(snapshot);
          if (equal(snapshot, this.data.brand)) this.data.brand = hosted;
          this.meta.brandSent = hosted; await this.commit();
        }
        try {
          const sent = this.meta.brandSent!;
          const response = await this.api.settings.save(sent, this.meta.brandRevision, this.meta.brandPending!);
          this.meta.brandRevision = response.revision;
          delete this.meta.brandSent;
          if (equal(this.data.brand, sent)) { this.data.brand = response.brand; delete this.meta.brandPending; }
          else this.meta.brandPending = crypto.randomUUID();
          await this.commit();
        } catch (error) {
          if (error instanceof OnlineError && error.status === 409) { this.meta.brandConflict = error.message; await this.commit(); }
          else throw error;
        }
      }
      this.error = ''; this.settle(); await this.commit();
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }
  async migrate() {
    if (!this.editor) return;
    for (const campaign of this.localCampaigns) this.meta.pending[campaign.id] = { revision: 0, operation: 'save', requestId: crypto.randomUUID() };
    if (!this.meta.brandRevision && this.meta.localBrand) { this.data.brand = this.meta.localBrand; this.meta.brandPending = crypto.randomUUID(); delete this.meta.localBrand; }
    this.settle(); await this.commit(); await this.sync();
  }
  async resolve(id: string, keepCopy: boolean) {
    const local = this.data.campaigns.find(c => c.id === id) ?? this.meta.trash.find(c => c.id === id);
    const row = await this.api.campaigns.get(id);
    if (local) {
      const copy = { ...local, id: crypto.randomUUID(), title: `${local.title} · cópia recuperada` };
      if (keepCopy) { this.data.campaigns.push(copy); this.meta.pending[copy.id] = { revision: 0, operation: 'save', requestId: crypto.randomUUID() }; }
      else this.meta.trash.push(copy);
    }
    delete this.meta.conflicts[id]; delete this.meta.pending[id]; delete this.meta.conflictDetails?.[id];
    this.accept(row); this.settle(); await this.commit();
  }
  async resolveBrand() {
    const response = await this.api.settings.get();
    this.meta.localBrand = this.data.brand; this.data.brand = response.brand;
    this.meta.brandRevision = response.revision;
    delete this.meta.brandConflict; delete this.meta.brandPending; delete this.meta.brandSent;
    this.settle(); await this.commit();
  }
  async restore(id: string, historical?: number) {
    if (this.meta.pending[id] || this.meta.conflicts[id]) throw new Error('Resolva ou sincronize as alterações pendentes antes de restaurar.');
    if (!this.meta.revisions[id]) {
      const local = this.meta.trash.find(c => c.id === id);
      if (local) { this.meta.trash = this.meta.trash.filter(c => c.id !== id); this.data.campaigns.push(local); }
    } else {
      const row = historical ? await this.api.campaigns.restoreRevision(id, this.meta.revisions[id], historical) : await this.api.campaigns.restore(id, this.meta.revisions[id]);
      this.accept(row);
    }
    await this.commit();
  }
  campaignState(id: string): SaveState {
    if (this.meta.conflicts[id]) return 'conflict';
    if (this.meta.pending[id]) return ['error', 'offline'].includes(this.state) ? this.state : this.editor ? 'saving' : 'offline';
    return this.meta.revisions[id] ? 'saved' : 'local';
  }
}
