'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2, Image, Type, LayoutTemplate } from 'lucide-react';
import { blockRegistry, createSection } from '@/blocks/registry';
import { duplicateSection, moveSection } from '@/blocks/model';
import type { Section, SectionType } from '@/types/design';
import type { Language } from '@/types/campaign';
import SectionFields from './SectionFields';
import { Modal } from './ui';
import SavedDesignDialog from './SavedDesignDialog';
import SavedDesignLibrary from './SavedDesignLibrary';
const icons = { image: Image, text: Type, layout: LayoutTemplate };
export default function SectionsEditor({ sections, language, onChange, reusable = true }: { sections: Section[]; language: Language; onChange: (s: Section[]) => void; reusable?: boolean }) {
  const [adding, setAdding] = useState(false), [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState<Section>(), [removing, setRemoving] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [feedback, setFeedback] = useState('');
  const patch = (s: Section) => onChange(sections.map(item => item.id === s.id ? s : item));
  const insert = (s: Section) => { if (sections.length >= 40) return; const next = duplicateSection(s); onChange([...sections, next]); setEditing(next.id); setAdding(false); setSaved(false); setFeedback(blockRegistry[s.type].name + ' adicionado ao e-mail.'); };
  return <div className="sections-editor">
    <div className="actions"><button type="button" className="button primary" disabled={sections.length >= 40} onClick={() => setAdding(true)}>Adicionar bloco</button>{reusable && <button type="button" className="button" disabled={sections.length >= 40} onClick={() => setSaved(true)}>Inserir bloco salvo</button>}</div>
    {feedback && <p className="action-feedback" role="status">{feedback} <button type="button" className="text-button" aria-label="Dispensar mensagem" onClick={() => setFeedback('')}>Fechar</button></p>}
    {!sections.length && <div className="asset-empty"><strong>Seu e-mail está pronto para receber blocos</strong><span>Escolha um bloco novo ou insira um modelo salvo pela equipe.</span></div>}
    {sections.map((section, index) => <article className="section-card" key={section.id} data-section-id={section.id}>
      <div className="section-heading"><button type="button" className="text-button" onClick={() => setEditing(editing === section.id ? undefined : section.id)}>{index + 1}. {blockRegistry[section.type].name}</button><label><input aria-label={'Ativar ' + blockRegistry[section.type].name} type="checkbox" checked={section.enabled} onChange={e => patch({ ...section, enabled: e.target.checked })} /> Ativo</label></div>
      <div className="actions"><button type="button" className="icon-button" aria-label="Subir bloco" disabled={index === 0} onClick={() => onChange(moveSection(sections, index, -1))}><ArrowUp size={16} /></button><button type="button" className="icon-button" aria-label="Descer bloco" disabled={index === sections.length - 1} onClick={() => onChange(moveSection(sections, index, 1))}><ArrowDown size={16} /></button><button type="button" className="icon-button" aria-label="Duplicar bloco" disabled={sections.length >= 40} onClick={() => { const next = duplicateSection(section); onChange([...sections.slice(0, index + 1), next, ...sections.slice(index + 1)]); }}><Copy size={16} /></button><button type="button" className="icon-button" aria-label="Remover bloco" onClick={() => setRemoving(section.id)}><Trash2 size={16} /></button>{reusable && <button type="button" className="text-button" onClick={() => setSaving(section)}>Salvar bloco reutilizável</button>}</div>
      {editing === section.id && <SectionFields section={section} language={language} onChange={patch} />}
    </article>)}
    {adding && <Modal title="Adicionar bloco" onClose={() => setAdding(false)} wide><div className="block-catalog">{Object.entries(blockRegistry).map(([key, definition]) => { const Icon = icons[definition.icon]; return <button type="button" className="button" key={key} onClick={() => insert(createSection(key as SectionType))}><Icon size={22} />{definition.name}</button>; })}</div></Modal>}
    {removing && <Modal title="Remover bloco" onClose={() => setRemoving(undefined)}><p>Remover esta seção da campanha? O histórico compartilhado conserva as versões anteriores.</p><div className="modal-actions"><button className="button" type="button" onClick={() => setRemoving(undefined)}>Cancelar</button><button className="button danger" type="button" onClick={() => { onChange(sections.filter(s => s.id !== removing)); setFeedback('Bloco removido do e-mail.'); setRemoving(undefined); }}>Remover bloco</button></div></Modal>}
    {saving && <SavedDesignDialog initial={{ kind: 'block', payload: saving }} onClose={() => setSaving(undefined)} onSaved={() => setFeedback('Bloco salvo na biblioteca compartilhada.')} />}
    {saved && <Modal title="Blocos Granistone" onClose={() => setSaved(false)} wide><SavedDesignLibrary kind="block" onUse={design => { if (design.kind === 'block') insert(design.payload); }} /></Modal>}
  </div>;
}
