'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2, Image, Type, LayoutTemplate, GripVertical } from 'lucide-react';
import { blockRegistry, createSection } from '@/blocks/registry';
import { duplicateSection, moveSection, moveSectionTo } from '@/blocks/model';
import type { Section, SectionType } from '@/types/design';
import type { Language } from '@/types/campaign';
import SectionFields from './SectionFields';
import { Modal } from './ui';
import SavedDesignDialog from './SavedDesignDialog';
import SavedDesignLibrary from './SavedDesignLibrary';
const icons = { image: Image, text: Type, layout: LayoutTemplate };
export default function SectionsEditor({ sections, language, onChange, reusable = true, focusRequest }: { sections: Section[]; language: Language; onChange: (s: Section[]) => void; reusable?: boolean; focusRequest?: { id: string; sequence: number } }) {
  const [adding, setAdding] = useState(false), [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState<Section>(), [removing, setRemoving] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [feedback, setFeedback] = useState('');
  const [dragging, setDragging] = useState<string>();
  const [drop, setDrop] = useState<{ id: string; after: boolean }>();
  const pointer = useRef<{ id: number; sectionId: string; x: number; y: number; target?: { id: string; after: boolean } } | undefined>(undefined);
  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => {
      setEditing(focusRequest.id);
      document.querySelector(`.sections-editor .section-card[data-section-id="${focusRequest.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);
  function startDrag(event: PointerEvent<HTMLButtonElement>, sectionId: string) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, sectionId, x: event.clientX, y: event.clientY };
    event.preventDefault();
  }
  function dragMove(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.abs(event.clientX - current.x) + Math.abs(event.clientY - current.y) < 5 && !dragging) return;
    if (!dragging) setDragging(current.sectionId);
    const scrollHost = event.currentTarget.closest<HTMLElement>('.editor-fields');
    if (scrollHost) {
      const bounds = scrollHost.getBoundingClientRect();
      if (event.clientY < bounds.top + 44) scrollHost.scrollTop -= 28;
      else if (event.clientY > bounds.bottom - 44) scrollHost.scrollTop += 28;
    }
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.section-card');
    const id = card?.dataset.sectionId;
    if (card && id && id !== current.sectionId) {
      const after = event.clientY >= card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
      current.target = { id, after }; setDrop(current.target);
    } else { current.target = undefined; setDrop(undefined); }
  }
  function stopDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.target) {
      const from = sections.findIndex(section => section.id === current.sectionId);
      const target = sections.findIndex(section => section.id === current.target?.id);
      const insertion = target + (current.target.after ? 1 : 0);
      const to = insertion > from ? insertion - 1 : insertion;
      const moved = moveSectionTo(sections, from, to);
      if (moved !== sections) { onChange(moved); setFeedback('Ordem dos blocos atualizada.'); }
    }
    pointer.current = undefined; setDragging(undefined); setDrop(undefined);
  }
  const patch = (s: Section) => onChange(sections.map(item => item.id === s.id ? s : item));
  const insert = (s: Section) => { if (sections.length >= 40) return; const next = duplicateSection(s); onChange([...sections, next]); setEditing(next.id); setAdding(false); setSaved(false); setFeedback(blockRegistry[s.type].name + ' adicionado ao e-mail.'); };
  return <div className="sections-editor">
    <div className="actions"><button type="button" className="button primary" disabled={sections.length >= 40} onClick={() => setAdding(true)}>Adicionar bloco</button>{reusable && <button type="button" className="button" disabled={sections.length >= 40} onClick={() => setSaved(true)}>Inserir bloco salvo</button>}</div>
    {!!sections.length && <p className="section-drag-instructions" id="section-drag-instructions">Arraste a alça ⋮⋮ para reorganizar. Para usar o teclado, escolha Subir bloco ou Descer bloco.</p>}
    {feedback && <p className="action-feedback" role="status">{feedback} <button type="button" className="text-button" aria-label="Dispensar mensagem" onClick={() => setFeedback('')}>Fechar</button></p>}
    {!sections.length && <div className="asset-empty"><strong>Seu e-mail está pronto para receber blocos</strong><span>Escolha um bloco novo ou insira um modelo salvo pela equipe.</span></div>}
    {sections.map((section, index) => <article className={`section-card${dragging === section.id ? ' dragging' : ''}${drop?.id === section.id ? drop.after ? ' drop-after' : ' drop-before' : ''}`} key={section.id} data-section-id={section.id}>
      <div className="section-heading"><div className="section-heading-main"><button type="button" className="section-drag-handle" title="Arrastar para reorganizar" aria-label={`Arrastar bloco ${index + 1}: ${blockRegistry[section.type].name}`} aria-describedby="section-drag-instructions" aria-grabbed={dragging === section.id}
        onPointerDown={event => startDrag(event, section.id)} onPointerMove={dragMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}><GripVertical size={19} /></button><button type="button" className="text-button" onClick={() => setEditing(editing === section.id ? undefined : section.id)}>{String(index + 1).padStart(2, '0')} · {blockRegistry[section.type].name}</button></div><label><input aria-label={'Ativar ' + blockRegistry[section.type].name} type="checkbox" checked={section.enabled} onChange={e => patch({ ...section, enabled: e.target.checked })} /> Ativo</label></div>
      <div className="actions"><button type="button" className="icon-button" aria-label="Subir bloco" disabled={index === 0} onClick={() => onChange(moveSection(sections, index, -1))}><ArrowUp size={16} /></button><button type="button" className="icon-button" aria-label="Descer bloco" disabled={index === sections.length - 1} onClick={() => onChange(moveSection(sections, index, 1))}><ArrowDown size={16} /></button><button type="button" className="icon-button" aria-label="Duplicar bloco" disabled={sections.length >= 40} onClick={() => { const next = duplicateSection(section); onChange([...sections.slice(0, index + 1), next, ...sections.slice(index + 1)]); }}><Copy size={16} /></button><button type="button" className="icon-button" aria-label="Remover bloco" onClick={() => setRemoving(section.id)}><Trash2 size={16} /></button>{reusable && <button type="button" className="text-button" onClick={() => setSaving(section)}>Salvar bloco reutilizável</button>}</div>
      {editing === section.id && <SectionFields section={section} language={language} onChange={patch} />}
    </article>)}
    {adding && <Modal title="Adicionar bloco" onClose={() => setAdding(false)} wide><div className="block-catalog">{Object.entries(blockRegistry).map(([key, definition]) => { const Icon = icons[definition.icon]; return <button type="button" className="button" key={key} onClick={() => insert(createSection(key as SectionType))}><Icon size={22} />{definition.name}</button>; })}</div></Modal>}
    {removing && <Modal title="Remover bloco" onClose={() => setRemoving(undefined)}><p>Remover esta seção da campanha? O histórico compartilhado conserva as versões anteriores.</p><div className="modal-actions"><button className="button" type="button" onClick={() => setRemoving(undefined)}>Cancelar</button><button className="button danger" type="button" onClick={() => { onChange(sections.filter(s => s.id !== removing)); setFeedback('Bloco removido do e-mail.'); setRemoving(undefined); }}>Remover bloco</button></div></Modal>}
    {saving && <SavedDesignDialog initial={{ kind: 'block', payload: saving }} onClose={() => setSaving(undefined)} onSaved={() => setFeedback('Bloco salvo na biblioteca compartilhada.')} />}
    {saved && <Modal title="Blocos Granistone" onClose={() => setSaved(false)} wide><SavedDesignLibrary kind="block" onUse={design => { if (design.kind === 'block') insert(design.payload); }} /></Modal>}
  </div>;
}
