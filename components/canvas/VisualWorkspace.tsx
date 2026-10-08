'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, Plus, Settings2, Trash2, X } from 'lucide-react';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { Section, SectionType } from '@/types/design';
import { blockRegistry, createSection } from '@/blocks/registry';
import { duplicateSection, moveSection, moveSectionTo } from '@/blocks/model';
import { defaultDesign } from '@/lib/tokens/backgrounds';
import { contentChecks } from '@/export/preflight';
import { languages } from '@/campaigns/model';
import { GranistoneHeader, GranistoneFooter } from '@/components/email/brand';
import type { SaveState } from '@/lib/use-studio';
import { SectionContent, LegacyContent, backgroundStyle, type CanvasSelection } from './CanvasContent';
import ImagePicker from '../ImagePicker';
import BackgroundEditor, { ColorField } from '../BackgroundEditor';
import AlignmentControl from '../AlignmentControl';
import SavedDesignDialog from '../SavedDesignDialog';
import SavedDesignLibrary from '../SavedDesignLibrary';
import { Field, Modal } from '../ui';

export default function VisualWorkspace({ campaign, brand, language, readOnly, onChange, onUndo, onRedo, saveState, onAdvanced, review, onReviewClose, onLanguage }: {
  campaign: Campaign; brand: BrandSettings; language: Language; readOnly: boolean; onChange: (patch: Partial<Campaign>, group?: string) => void;
  onUndo: () => void; onRedo: () => void; saveState: SaveState; onAdvanced: (tab?: 'content' | 'blocks') => void; review: boolean; onReviewClose: () => void; onLanguage: (language: Language) => void;
}) {
  const [selected, setSelected] = useState<CanvasSelection>();
  const [library, setLibrary] = useState(false), [inspector, setInspector] = useState(false);
  const [insertion, setInsertion] = useState<number>();
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState<Section>();
  const [dragging, setDragging] = useState<string>(), [drop, setDrop] = useState<{ id: string; after: boolean }>();
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ pointerId: number; id: string; x: number; y: number; lastX: number; lastY: number; target?: { id: string; after: boolean } } | undefined>(undefined);
  const sections = campaign.sections;
  const section = sections?.find(s => s.id === selected?.id);
  const design = campaign.design ?? defaultDesign();
  const select = (next: CanvasSelection) => { setSelected(next); if (next.kind === 'image') setInspector(true); };
  const changeSection = (next: Section, group?: string) => onChange({ sections: sections?.map(s => s.id === next.id ? next : s) }, group);
  const settings = (patch: Partial<Section['settings']>) => { if (section) changeSection({ ...section, settings: { ...section.settings, ...patch } }); };
  const insert = (source: Section) => {
    if (readOnly || !sections || sections.length >= 40) return;
    const next = duplicateSection(source), at = Math.min(insertion ?? sections.length, sections.length);
    onChange({ sections: [...sections.slice(0, at), next, ...sections.slice(at)] });
    setSelected({ id: next.id, kind: 'block' }); setInsertion(undefined); setLibrary(false); setSaved(false);
    requestAnimationFrame(() => document.querySelector(`[data-canvas-block="${next.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };
  const remove = (id: string) => { if (readOnly) return; onChange({ sections: sections?.filter(s => s.id !== id) }); setSelected(undefined); };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === 'Escape') { pointer.current = undefined; setDragging(undefined); setDrop(undefined); setSelected(undefined); setInspector(false); setLibrary(false); target.blur(); return; }
      if (target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if (event.key === 'Delete' && selected && sections?.some(s => s.id === selected.id)) { event.preventDefault(); remove(selected.id); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  useEffect(() => {
    if (!dragging || readOnly) return;
    let frame = 0;
    const scroll = () => {
      const p = pointer.current, host = stage.current;
      if (!p || !host) return;
      const bounds = host.getBoundingClientRect();
      const direction = p.lastY < bounds.top + 60 ? -1 : p.lastY > bounds.bottom - 60 ? 1 : 0;
      if (direction) {
        host.scrollTop += direction * 12;
        const card = document.elementFromPoint(p.lastX, Math.min(bounds.bottom - 2, Math.max(bounds.top + 2, p.lastY)))?.closest<HTMLElement>('[data-canvas-block]');
        if (card && card.dataset.canvasBlock !== p.id) {
          const rect = card.getBoundingClientRect(); p.target = { id: card.dataset.canvasBlock!, after: p.lastY > rect.top + rect.height / 2 };
          const target = p.target;
          setDrop(old => old?.id === target.id && old?.after === target.after ? old : target);
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [dragging, readOnly]);
  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (readOnly || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
    select({ id, kind: 'block' });
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const p = pointer.current; if (!p || event.pointerId !== p.pointerId || readOnly) return;
    p.lastX = event.clientX; p.lastY = event.clientY;
    if (!dragging && Math.abs(event.clientY - p.y) + Math.abs(event.clientX - p.x) < 5) return;
    setDragging(p.id);
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-canvas-block]');
    if (card && card.dataset.canvasBlock !== p.id) { const rect = card.getBoundingClientRect(); p.target = { id: card.dataset.canvasBlock!, after: event.clientY > rect.top + rect.height / 2 }; }
    else p.target = undefined;
    setDrop(p.target);
  }
  function stop(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const p = pointer.current; if (!p || p.pointerId !== event.pointerId) return;
    if (!cancel && !readOnly && p.target && sections) {
      const from = sections.findIndex(s => s.id === p.id), to = sections.findIndex(s => s.id === p.target?.id) + (p.target.after ? 1 : 0);
      onChange({ sections: moveSectionTo(sections, from, to > from ? to - 1 : to) });
    }
    pointer.current = undefined; setDragging(undefined); setDrop(undefined);
  }
  const addAt = (index: number) => <button className="canvas-insert" disabled={readOnly || (sections?.length ?? 0) >= 40} aria-label={`Inserir bloco na posição ${index + 1}`} onClick={() => { setInsertion(index); setLibrary(true); }}><Plus size={13} /></button>;
  const imageKey = selected?.kind === 'image' ? selected.field : undefined;
  const imageAlt = imageKey === 'image2' ? 'alt2' : imageKey === 'applicationImage' ? 'applicationAlt' : imageKey === 'heroImage' ? 'heroAlt' : 'alt';
  const imageContent = section?.content[language] ?? campaign.content[language] as unknown as Record<string, string>;
  const imageSize = section ? ['heroEditorial', 'heroProduct', 'banner'].includes(section.type) ? '1200 × 800 px' : ['product', 'twoProducts'].includes(section.type) ? '800 × 800 px' : section.type === 'gallery' ? '700 × 900 px' : '1200 × 700 px' : imageKey === 'heroImage' ? '1200 × 700 px' : '1200 × 800 px';
  const imageChange = (value: string, alt?: string) => {
    if (!imageKey || readOnly) return;
    if (section) {
      const content = structuredClone(section.content);
      for (const lang of ['pt', 'en', 'es'] as const) content[lang][imageKey] = value;
      if (alt) content[language][imageAlt] = alt;
      changeSection({ ...section, content });
    } else {
      const content = structuredClone(campaign.content);
      for (const lang of ['pt', 'en', 'es'] as const) Object.assign(content[lang], { [imageKey]: value });
      if (alt) Object.assign(content[language], { [imageAlt]: alt });
      onChange({ content });
    }
  };
  const imageAltChange = (value: string) => section ? changeSection({ ...section, content: { ...section.content, [language]: { ...section.content[language], [imageAlt]: value } } }) : onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], [imageAlt]: value } } });
  return <div className="visual-workspace">
    <div className="visual-workspace-bar"><div><button className="button" aria-expanded={library} onClick={() => setLibrary(!library)}>＋ Biblioteca</button><button className="button" aria-expanded={inspector} onClick={() => setInspector(!inspector)}><Settings2 size={14} /> Propriedades</button></div><span>{readOnly ? 'Somente leitura · inicie uma sessão para editar' : 'Clique para escrever · selecione um trecho para formatar'}</span><button className="text-button" onClick={() => onAdvanced()}>Configurações avançadas</button></div>
    <div className="visual-columns">
      {library && <aside className="canvas-library" aria-label="Biblioteca de blocos"><header><strong>Biblioteca</strong><button aria-label="Recolher biblioteca" onClick={() => setLibrary(false)}><X size={16} /></button></header>
        {sections ? <><p className="muted">{insertion === undefined ? 'Adicionar ao final' : `Inserir na posição ${insertion + 1}`} · {sections.length}/40 blocos</p><div className="quick-blocks">{Object.entries(blockRegistry).map(([type, definition]) => <button className="button" key={type} disabled={readOnly || sections.length >= 40} onClick={() => insert(createSection(type as SectionType))}>{definition.name}</button>)}</div><button className="button" disabled={readOnly || sections.length >= 40} onClick={() => setSaved(true)}>Inserir bloco salvo</button></> : <><p>Esta campanha preserva a composição original do template.</p><p className="muted">Para adicionar blocos livres, use a conversão reversível em Estrutura nas configurações avançadas.</p><button className="button" onClick={() => onAdvanced('blocks')}>Abrir estrutura e templates</button></>}
        <p className="muted">Para trocar fotografias, clique na imagem e escolha Biblioteca. Os materiais compartilhados continuam disponíveis.</p>
      </aside>}
      <div className="visual-stage" ref={stage} onClick={event => { if (!(event.target as HTMLElement).closest('[data-canvas-block],.canvas-text,.canvas-picture')) { setSelected(undefined); setInspector(false); } }}>
        <div className="canvas-envelope"><Field label="Assunto" disabled={readOnly} value={campaign.content[language].subject} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], subject: event.target.value } } }, 'subject:' + language)} /><Field label="Preheader" disabled={readOnly} value={campaign.content[language].preheader} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], preheader: event.target.value } } }, 'preheader:' + language)} /></div>
        <div className="visual-email" aria-label="Composição do e-mail" style={{ ...backgroundStyle(design.content), color: design.textColor }}>
          <table className="canvas-brand" role="presentation" aria-label="Cabeçalho fixo" onClick={event => event.preventDefault()}><tbody dangerouslySetInnerHTML={{ __html: GranistoneHeader(brand) }} /></table>
          {sections ? <>{addAt(0)}{sections.map((s, index) => <div key={s.id}>
            <article tabIndex={0} data-canvas-block={s.id} aria-label={`Bloco ${index + 1}: ${blockRegistry[s.type].name}`} className={`canvas-block${selected?.id === s.id ? ' selected' : ''}${!s.enabled ? ' hidden-block' : ''}${dragging === s.id ? ' dragging' : ''}${drop?.id === s.id ? drop.after ? ' drop-after' : ' drop-before' : ''}`} onClick={() => { if (selected?.id !== s.id) select({ id: s.id, kind: 'block' }); }} onFocus={event => { if (event.target === event.currentTarget) select({ id: s.id, kind: 'block' }); }}>
              {!readOnly && <div className="canvas-block-actions" aria-label="Ações do bloco" onClick={event => event.stopPropagation()}>
                <button className="canvas-grip" aria-label="Arrastar bloco" title="Arraste para mover; use Subir e Descer pelo teclado" onPointerDown={event => start(event, s.id)} onPointerMove={move} onPointerUp={event => stop(event)} onPointerCancel={event => stop(event, true)} onLostPointerCapture={event => stop(event, true)}><GripVertical size={16} /></button>
                <span>{blockRegistry[s.type].name}</span>
                <button aria-label="Subir bloco" disabled={index === 0} onClick={() => onChange({ sections: moveSection(sections, index, -1) })}><ArrowUp size={14} /></button>
                <button aria-label="Descer bloco" disabled={index === sections.length - 1} onClick={() => onChange({ sections: moveSection(sections, index, 1) })}><ArrowDown size={14} /></button>
                <button aria-label="Duplicar bloco" disabled={sections.length >= 40} onClick={() => { const copy = duplicateSection(s); onChange({ sections: [...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)] }); select({ id: copy.id, kind: 'block' }); }}><Copy size={14} /></button>
                <button aria-label={s.enabled ? 'Ocultar bloco' : 'Exibir bloco'} onClick={() => changeSection({ ...s, enabled: !s.enabled })}><Eye size={14} /></button>
                <button aria-label="Remover bloco" onClick={() => remove(s.id)}><Trash2 size={14} /></button>
                <button aria-label="Propriedades do bloco" onClick={() => { select({ id: s.id, kind: 'block' }); setInspector(true); }}><Settings2 size={14} /></button>
                <button aria-label="Salvar bloco reutilizável" onClick={() => setSaving(s)}>Salvar</button>
              </div>}
              {!s.enabled ? <button className="canvas-hidden-label" onClick={() => { select({ id: s.id, kind: 'block' }); setInspector(true); }}>Bloco oculto · {blockRegistry[s.type].name}</button> : <SectionContent section={s} language={language} readOnly={readOnly} onChange={changeSection} onSelect={select} onUndo={onUndo} onRedo={onRedo} />}
            </article>{addAt(index + 1)}
          </div>)}</> : <LegacyContent campaign={campaign} language={language} readOnly={readOnly} onChange={onChange} onSelect={select} onUndo={onUndo} onRedo={onRedo} />}
          <table className="canvas-brand" role="presentation" aria-label="Rodapé fixo" onClick={event => event.preventDefault()}><tbody dangerouslySetInnerHTML={{ __html: GranistoneFooter(brand, language) }} /></table>
        </div><p className="canvas-footnote">600 px · {language.toUpperCase()} · Cabeçalho e rodapé configurados em Marca</p>
      </div>
      {inspector && <aside className="canvas-inspector" aria-label="Propriedades do elemento"><header><strong>{selected?.kind === 'image' ? 'Imagem' : selected?.kind === 'text' ? 'Texto' : section ? blockRegistry[section.type].name : 'E-mail'}</strong><button aria-label="Recolher propriedades" onClick={() => setInspector(false)}><X size={16} /></button></header><div inert={readOnly} aria-disabled={readOnly}>
        {selected && <p className="muted">{section ? blockRegistry[section.type].name : 'Template original'}{selected.field && section ? ' · ' + (blockRegistry[section.type].fields.find(f => f.key === selected.field)?.label ?? '') : ''}</p>}
        {imageKey && <ImagePicker key={`${selected?.id}:${imageKey}:${language}`} label={imageKey === 'image2' ? 'Imagem do bloco 2' : section ? 'Imagem do bloco' : imageKey === 'heroImage' ? 'Imagem principal' : 'Imagem de aplicação'} value={imageContent[imageKey] || ''} alt={imageContent[imageAlt] || ''} recommended={imageSize} materialId={campaign.materialId} saveState={saveState} onChange={imageChange} onAlt={imageAltChange} />}
        {section ? <>
          <label className="field"><span>Estilo do bloco</span><select aria-label="Aplicar estilo do bloco" value="" onChange={event => {
            const presets: Record<string, Partial<Section['settings']>> = { editorial: { background: { kind: 'solid', color: '#FFFFFF' }, textColor: '#111111', padding: 36, alignment: 'left' }, mineral: { background: { kind: 'solid', color: '#F5F3EF' }, textColor: '#111111', padding: 36, alignment: 'center' }, premium: { background: { kind: 'solid', color: '#111111' }, textColor: '#FFFFFF', padding: 40, alignment: 'center' } };
            if (presets[event.target.value]) settings(presets[event.target.value]);
          }}><option value="">Escolher um estilo…</option><option value="editorial">Branco editorial</option><option value="mineral">Mineral</option><option value="premium">Preto premium</option></select></label>
          {blockRegistry[section.type].fields.filter(f => f.kind === 'url').map(f => <Field key={f.key} label={f.label} value={section.content[language][f.key]} onChange={event => changeSection({ ...section, content: { ...section.content, [language]: { ...section.content[language], [f.key]: event.target.value } } })} />)}
          <AlignmentControl label="Alinhamento do bloco" value={section.settings.alignment} onChange={alignment => settings({ alignment })} />
          <ColorField label="Cor do texto do bloco" value={section.settings.textColor} onChange={textColor => settings({ textColor })} />
          <BackgroundEditor label="Fundo do bloco" value={section.settings.background} onChange={(background, textColor) => settings({ background, ...(textColor ? { textColor } : {}) })} />
          <label>Espaçamento interno · {section.settings.padding} px<input aria-label="Espaçamento interno" type="range" min="0" max="80" step="4" value={section.settings.padding} onChange={event => settings({ padding: Number(event.target.value) })} /></label>
          {section.type === 'spacer' && <label>Altura do espaçador<input aria-label="Altura do espaçador" type="range" min="8" max="200" step="4" value={section.settings.height} onChange={event => settings({ height: Number(event.target.value) })} /></label>}
          <label><input type="checkbox" checked={section.enabled} onChange={event => changeSection({ ...section, enabled: event.target.checked })} /> Exibir bloco</label>
        </> : <>
          {!sections && <><Field label="Link do botão" value={campaign.content[language].ctaUrl} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], ctaUrl: event.target.value } } })} />{selected?.field?.startsWith('article') && <Field label="Link do artigo" value={campaign.content[language].articleUrl} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], articleUrl: event.target.value } } })} />}<AlignmentControl value={campaign.alignment} onChange={alignment => onChange({ alignment })} /></>}
          <BackgroundEditor label="Fundo do e-mail" value={design.email} onChange={email => onChange({ design: { ...design, email } })} />
          <BackgroundEditor label="Fundo do conteúdo" value={design.content} onChange={(content, textColor) => onChange({ design: { ...design, content, ...(textColor ? { textColor } : {}) } })} />
          <ColorField label="Cor do texto do conteúdo" value={design.textColor} onChange={textColor => onChange({ design: { ...design, textColor } })} />
        </>}
        <p className="muted">Tipografia editorial Granistone. Selecione um trecho no canvas para formatar.</p>
      </div></aside>}
    </div>
    {saving && !readOnly && <SavedDesignDialog initial={{ kind: 'block', payload: saving }} onClose={() => setSaving(undefined)} />}
    {saved && <Modal title="Blocos Granistone" onClose={() => setSaved(false)} wide><SavedDesignLibrary kind="block" onUse={design => { if (design.kind === 'block') insert(design.payload); }} /></Modal>}
    {review && <Modal title="Revisão da campanha" onClose={onReviewClose} wide><p>Revise os idiomas planejados antes de exportar. A publicação também verifica os arquivos e o HTML final.</p>{languages(campaign).map(lang => <section key={lang}><h3>{lang.toUpperCase()}</h3>{contentChecks(campaign, lang, brand).filter(c => c.severity !== 'pass').map(check => <p key={check.id} className={check.severity === 'error' ? 'alert' : 'muted'}>{check.message} {check.sectionId && <button className="text-button" onClick={() => {
      onLanguage(lang); onReviewClose();
      const s = sections?.find(s => s.id === check.sectionId), field = blockRegistry[s?.type ?? 'centeredText'].fields.find(f => f.key === check.field);
      const image = field?.kind === 'image' || field?.kind === 'alt';
      setSelected({ id: check.sectionId!, field: image ? check.field?.endsWith('2') ? 'image2' : 'image' : check.field, kind: image ? 'image' : field?.kind === 'url' ? 'block' : 'text' }); setInspector(true);
      requestAnimationFrame(() => document.querySelector(`[data-canvas-block="${check.sectionId}"]`)?.scrollIntoView({ block: 'center' }));
    }}>Localizar no e-mail</button>}</p>)}</section>)}<button className="button" onClick={() => { onReviewClose(); setInspector(true); }}>Voltar à composição</button></Modal>}
  </div>;
}
