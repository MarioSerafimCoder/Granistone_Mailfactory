'use client';
import { useContext, useState } from 'react';
import type { Blueprint, DesignInput, SavedDesign, Section } from '@/types/design';
import type { Language } from '@/types/campaign';
import { CollaborationContext, useEditLease } from '@/lib/use-collaboration';
import { useResourceDraft } from '@/lib/use-resource-draft';
import { online } from '@/lib/online';
import { hostLocalImages } from '@/lib/workspace-images';
import { Field, Modal, TextArea, Select } from './ui';
import { EditLeaseBar } from './WorkspacePresence';
import ResourceDraftRecovery from './ResourceDraftRecovery';
import SectionFields from './SectionFields';
import SectionsEditor from './SectionsEditor';
import BackgroundEditor, { ColorField } from './BackgroundEditor';
type Initial = { kind: 'block'; payload: Section } | { kind: 'template'; payload: Blueprint };
export default function SavedDesignDialog({ initial, existing, onClose, onSaved }: { initial: Initial; existing?: SavedDesign; onClose: () => void; onSaved?: () => void }) {
  const { session } = useContext(CollaborationContext);
  const [value, setValue] = useState<DesignInput>(() => existing ?? { ...structuredClone(initial), id: crypto.randomUUID(), name: '', description: '', category: 'Granistone', revision: 0 });
  const [language, setLanguage] = useState<Language>('pt'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lease = useEditLease('design', existing?.id, !!existing, !!session?.permissions.editCampaigns);
  const draft = useResourceDraft<DesignInput>('design', existing?.id, setValue, value.revision);
  const allowed = !!session?.permissions.editCampaigns && (!existing || lease.editing);
  async function save() {
    if (!allowed || busy) return; setBusy(true); setError('');
    try { const hosted = await hostLocalImages(value); await online.designs.save(hosted, !!existing); draft.clear(); onSaved?.(); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <Modal title={existing ? 'Editar ' + (value.kind === 'block' ? 'bloco' : 'template') : value.kind === 'block' ? 'Salvar bloco reutilizável' : 'Salvar como template'} onClose={() => { if (!busy) onClose(); }} wide>
    {!session?.member && <p className="alert">Entre no workspace para salvar na biblioteca compartilhada.</p>}
    {existing && <EditLeaseBar lease={lease} type="design" id={existing.id} onBegin={async () => { const fresh = await online.designs.get(existing.id); setValue(current => current.revision === fresh.revision ? current : fresh); }} />}
    <ResourceDraftRecovery draft={draft} />
    <fieldset className="lease-fields" disabled={!allowed || busy}><legend className="sr-only">Dados compartilhados</legend>
      <Field label="Nome" value={value.name} maxLength={120} onChange={e => draft.change({ ...value, name: e.target.value })} />
      <TextArea label="Descrição" value={value.description} onChange={e => draft.change({ ...value, description: e.target.value })} />
      <Field label="Categoria" value={value.category} maxLength={80} onChange={e => draft.change({ ...value, category: e.target.value })} />
      <Select label="Idioma do design" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></Select>
      {value.kind === 'block' ? <SectionFields section={value.payload} language={language} onChange={payload => draft.change({ ...value, payload })} /> : <>
        <p className="muted">Os campos entre colchetes são placeholders. As campanhas criadas serão cópias independentes deste template.</p>
        <BackgroundEditor label="Fundo do e-mail" value={value.payload.design.email} onChange={email => draft.change({ ...value, payload: { ...value.payload, design: { ...value.payload.design, email } } })} />
        <BackgroundEditor label="Fundo do conteúdo" value={value.payload.design.content} onChange={(content, textColor) => draft.change({ ...value, payload: { ...value.payload, design: { ...value.payload.design, content, textColor: textColor ?? value.payload.design.textColor } } })} />
        <ColorField label="Cor do texto do conteúdo" value={value.payload.design.textColor} onChange={textColor => draft.change({ ...value, payload: { ...value.payload, design: { ...value.payload.design, textColor } } })} />
        <SectionsEditor sections={value.payload.sections} language={language} reusable={false} onChange={sections => draft.change({ ...value, payload: { ...value.payload, sections } })} />
      </>}
    </fieldset>
    {existing && <p className="muted">Revisão {value.revision} · {existing.updatedBy}</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="button primary" disabled={!allowed || busy || !value.name.trim() || !value.category.trim()} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar na biblioteca'}</button></div>
  </Modal>;
}
