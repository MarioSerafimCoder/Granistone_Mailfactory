'use client';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, Images, LayoutGrid, MoreHorizontal, PanelLeftOpen, PanelRightOpen, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { Section, SectionType } from '@/types/design';
import { blockRegistry, createSection } from '@/blocks/registry';
import { convertSections, duplicateSection, moveSection, moveSectionTo } from '@/blocks/model';
import { defaultDesign } from '@/lib/tokens/backgrounds';
import { contentChecks } from '@/export/preflight';
import { changeTemplate, languages } from '@/campaigns/model';
import { GranistoneHeader, GranistoneFooter } from '@/components/email/brand';
import type { SaveState } from '@/lib/use-studio';
import { SectionContent, LegacyContent, backgroundStyle, type CanvasSelection } from './CanvasContent';
import ImagePicker from '../ImagePicker';
import BackgroundEditor, { ColorField } from '../BackgroundEditor';
import AlignmentControl from '../AlignmentControl';
import SectionFields from '../SectionFields';
import SavedDesignDialog from '../SavedDesignDialog';
import SavedDesignLibrary from '../SavedDesignLibrary';
import AssetLibrary from '../AssetLibrary';
import { templates } from '@/templates/registry';
import { Field, Modal } from '../ui';

const blockGroups: { title: string; types: SectionType[] }[] = [
  { title: 'Básicos', types: ['centeredText', 'cta'] },
  { title: 'Imagens', types: ['heroEditorial', 'imageText', 'textImage', 'gallery', 'banner'] },
  { title: 'Produtos', types: ['heroProduct', 'product', 'twoProducts', 'specifications', 'applications'] },
  { title: 'Editorial', types: ['quote'] },
  { title: 'Estrutura', types: ['divider', 'spacer'] },
  { title: 'Institucional', types: ['complementaryFooter'] },
];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function VisualWorkspace({ campaign, brand, language, readOnly, onChange, onUndo, onRedo, saveState, onAdvanced, review, onReviewClose, onLanguage, onFinalPreview, onExport, onPublish, canExport, canPublish }: {
  campaign: Campaign; brand: BrandSettings; language: Language; readOnly: boolean; onChange: (patch: Partial<Campaign>, group?: string) => void;
  onUndo: () => void; onRedo: () => void; saveState: SaveState; onAdvanced: (tab?: 'content' | 'blocks' | 'design') => void; review: boolean; onReviewClose: () => void; onLanguage: (language: Language) => void;
  onFinalPreview: () => void; onExport: () => void; onPublish: () => void; canExport: boolean; canPublish: boolean;
}) {
  const [selected, setSelected] = useState<CanvasSelection>();
  const [library, setLibrary] = useState(false), [inspector, setInspector] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'structure' | 'blocks' | 'templates' | 'images' | 'saved'>('blocks');
  const [inspectorTab, setInspectorTab] = useState<'content' | 'style' | 'advanced'>('content');
  const [blockQuery, setBlockQuery] = useState('');
  const [libraryHint, setLibraryHint] = useState('');
  const [insertion, setInsertion] = useState<number>();
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState<Section>();
  const [dragging, setDragging] = useState<string>(), [drop, setDrop] = useState<{ id: string; after: boolean }>();
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ pointerId: number; id: string; x: number; y: number; lastX: number; lastY: number; target?: { id: string; after: boolean } } | undefined>(undefined);
  const sections = campaign.sections;
  const editableSections = useMemo(() => sections ?? convertSections(campaign), [campaign, sections]);
  const section = sections?.find(s => s.id === selected?.id);
  const design = campaign.design ?? defaultDesign();
  const select = (next: CanvasSelection) => { setSelected(next); if (next.kind === 'image' || next.kind === 'block') { setInspectorTab(next.kind === 'block' ? 'style' : 'content'); setInspector(true); } };
  const changeSection = (next: Section, group?: string) => onChange({ sections: sections?.map(s => s.id === next.id ? next : s) }, group);
  const settings = (patch: Partial<Section['settings']>) => { if (section) changeSection({ ...section, settings: { ...section.settings, ...patch } }); };
  const insert = (source: Section) => {
    if (readOnly || editableSections.length >= 40) return;
    const next = duplicateSection(source), at = Math.min(insertion ?? editableSections.length, editableSections.length);
    onChange({ sections: [...editableSections.slice(0, at), next, ...editableSections.slice(at)] });
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
  const addAt = (index: number) => <button className="canvas-insert" disabled={readOnly || (sections?.length ?? 0) >= 40} aria-label={`Inserir bloco na posição ${index + 1}`} onClick={() => { setInsertion(index); setLibraryTab('blocks'); setLibrary(true); }}><Plus size={13} /></button>;
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
    <div className="visual-columns">
      {library ? <aside className="canvas-library" aria-label="Biblioteca de blocos"><header><strong>Biblioteca</strong><button aria-label="Recolher biblioteca" title="Recolher biblioteca" onClick={() => setLibrary(false)}><X size={17} /></button></header>
        <div className="canvas-panel-tabs" role="tablist" aria-label="Categorias da biblioteca">{([['structure', 'Estrutura'], ['blocks', 'Blocos'], ['saved', 'Salvos'], ['images', 'Imagens'], ['templates', 'Templates']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={libraryTab === key} className={libraryTab === key ? 'active' : ''} onClick={() => setLibraryTab(key)}>{label}</button>)}</div>
        {libraryTab === 'structure' && <section className="canvas-structure"><p className="canvas-panel-context">{editableSections.length} blocos · Cabeçalho e rodapé da marca são fixos.</p>{!sections && <button className="button" disabled={readOnly} onClick={() => onChange({ sections: editableSections })}>Organizar em blocos editáveis</button>}{sections?.map((item, index) => <div className="canvas-structure-row" key={item.id}><button className={selected?.id === item.id ? 'active' : ''} onClick={() => { select({ id: item.id, kind: 'block' }); requestAnimationFrame(() => document.querySelector(`[data-canvas-block="${item.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })); }}><span>{String(index + 1).padStart(2, '0')}</span>{blockRegistry[item.type].name}</button><div><button aria-label={`Subir ${blockRegistry[item.type].name}`} disabled={readOnly || index === 0} onClick={() => onChange({ sections: moveSection(sections, index, -1) })}><ArrowUp size={15} /></button><button aria-label={`Descer ${blockRegistry[item.type].name}`} disabled={readOnly || index === sections.length - 1} onClick={() => onChange({ sections: moveSection(sections, index, 1) })}><ArrowDown size={15} /></button></div></div>)}</section>}
        {libraryTab === 'blocks' && <><p className="canvas-panel-context">{insertion === undefined ? 'Adicionar ao final' : `Inserir na posição ${insertion + 1}`} · {editableSections.length}/40 blocos</p>{!sections && <p className="canvas-panel-context">Ao inserir, a composição será organizada em blocos editáveis. Você pode desfazer essa alteração.</p>}<label className="canvas-search"><Search size={16} /><input aria-label="Buscar blocos" placeholder="Buscar bloco" value={blockQuery} onChange={event => setBlockQuery(event.target.value)} /></label>{blockGroups.map(group => { const types = group.types.filter(type => normalize(blockRegistry[type].name).includes(normalize(blockQuery))); return types.length ? <section className="canvas-library-group" key={group.title}><h3>{group.title}</h3><div className="quick-blocks">{types.map(type => <button className="canvas-block-card" key={type} disabled={readOnly || editableSections.length >= 40} onClick={() => insert(createSection(type))}><span className={`canvas-block-mini mini-${type}`} aria-hidden="true"><i /><i /><i /></span><span>{blockRegistry[type].name}</span><Plus size={14} /></button>)}</div></section> : null; })}{!blockGroups.some(group => group.types.some(type => normalize(blockRegistry[type].name).includes(normalize(blockQuery)))) && <p className="muted">Nenhum bloco encontrado.</p>}</>}
        {libraryTab === 'templates' && <><p className="canvas-panel-context">Escolha o template da campanha. Você pode desfazer a troca.</p><div className="quick-blocks">{templates.map(template => <button className="canvas-block-card" key={template.id} disabled={readOnly} aria-pressed={campaign.template === template.id} onClick={() => { if (campaign.template !== template.id) onChange(changeTemplate(campaign, template.id)); setSelected(undefined); setInspector(false); setLibrary(false); }}><span className="canvas-block-mini mini-template" aria-hidden="true"><i /><i /><i /></span><span>{template.name}</span></button>)}</div></>}
        {libraryTab === 'images' && <><p className="canvas-panel-context">Selecione uma imagem no e-mail para substituí-la por um arquivo da biblioteca ou de um material.</p>{libraryHint && <p role="status" className="canvas-panel-context">{libraryHint}</p>}<AssetLibrary embedded lazy materialId={campaign.materialId} onSelect={asset => { if (selected?.kind === 'image') { imageChange(asset.url, asset.alt); setLibraryHint('Imagem aplicada.'); } else setLibraryHint('Selecione primeiro uma imagem na composição.'); }} /></>}
        {libraryTab === 'saved' && <SavedDesignLibrary kind="block" onUse={design => { if (design.kind === 'block') insert(design.payload); }} />}
      </aside> : <div className="canvas-panel-rail"><button aria-label="Abrir biblioteca" title="Abrir biblioteca" onClick={() => setLibrary(true)}><PanelLeftOpen size={19} /></button><button aria-label="Abrir estrutura" title="Estrutura" onClick={() => { setLibraryTab('structure'); setLibrary(true); }}><LayoutGrid size={18} /></button><button aria-label="Abrir imagens e materiais" title="Imagens e materiais" onClick={() => { setLibraryTab('images'); setLibrary(true); }}><Images size={18} /></button><button aria-label="Abrir templates" title="Templates" onClick={() => { setLibraryTab('templates'); setLibrary(true); }}><LayoutGrid size={18} /></button></div>}
      <div className="visual-stage" ref={stage} onClick={event => { if (!(event.target as HTMLElement).closest('[data-canvas-block],.canvas-text,.canvas-picture')) { setSelected(undefined); setInspectorTab('style'); } }}>
        <div className="canvas-envelope"><Field label="Assunto" disabled={readOnly} value={campaign.content[language].subject} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], subject: event.target.value } } }, 'subject:' + language)} /><Field label="Preheader" disabled={readOnly} value={campaign.content[language].preheader} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], preheader: event.target.value } } }, 'preheader:' + language)} /></div>
        <div className="visual-email" aria-label="Composição do e-mail" style={{ ...backgroundStyle(design.content), color: design.textColor }}>
          <table className="canvas-brand" role="presentation" aria-label="Cabeçalho fixo" onClick={event => event.preventDefault()}><tbody dangerouslySetInnerHTML={{ __html: GranistoneHeader(brand) }} /></table>
          {sections ? <>{addAt(0)}{sections.map((s, index) => <div key={s.id}>
            <article tabIndex={0} data-canvas-block={s.id} aria-label={`Bloco ${index + 1}: ${blockRegistry[s.type].name}`} className={`canvas-block${selected?.id === s.id ? ' selected' : ''}${!s.enabled ? ' hidden-block' : ''}${dragging === s.id ? ' dragging' : ''}${drop?.id === s.id ? drop.after ? ' drop-after' : ' drop-before' : ''}`} onClick={() => { if (selected?.id !== s.id) select({ id: s.id, kind: 'block' }); }} onFocus={event => { if (event.target === event.currentTarget) select({ id: s.id, kind: 'block' }); }}>
              {!readOnly && <div className="canvas-block-actions" aria-label="Ações do bloco" onClick={event => event.stopPropagation()}>
                <button className="canvas-grip" aria-label="Arrastar bloco" title="Arraste para mover; use Subir e Descer pelo teclado" onPointerDown={event => start(event, s.id)} onPointerMove={move} onPointerUp={event => stop(event)} onPointerCancel={event => stop(event, true)} onLostPointerCapture={event => stop(event, true)}><GripVertical size={16} /></button>
                <span>{blockRegistry[s.type].name}</span>
                <button aria-label="Editar bloco" onClick={() => { select({ id: s.id, kind: 'block' }); setInspectorTab('content'); setInspector(true); }}><Settings2 size={14} /></button>
                <button aria-label="Duplicar bloco" disabled={sections.length >= 40} onClick={() => { const copy = duplicateSection(s); onChange({ sections: [...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)] }); select({ id: copy.id, kind: 'block' }); }}><Copy size={14} /></button>
                <button aria-label={s.enabled ? 'Ocultar bloco' : 'Exibir bloco'} onClick={() => changeSection({ ...s, enabled: !s.enabled })}><Eye size={14} /></button>
                <button aria-label="Remover bloco" onClick={() => remove(s.id)}><Trash2 size={14} /></button>
                <details className="canvas-block-more"><summary aria-label="Mais opções do bloco" title="Mais opções"><MoreHorizontal size={17} /></summary><div>
                  <button aria-label="Subir bloco" disabled={index === 0} onClick={() => onChange({ sections: moveSection(sections, index, -1) })}><ArrowUp size={14} /> Subir</button>
                  <button aria-label="Descer bloco" disabled={index === sections.length - 1} onClick={() => onChange({ sections: moveSection(sections, index, 1) })}><ArrowDown size={14} /> Descer</button>
                  <button aria-label="Propriedades do bloco" onClick={() => { select({ id: s.id, kind: 'block' }); setInspectorTab('style'); setInspector(true); }}><Settings2 size={14} /> Propriedades</button>
                  <button aria-label="Salvar bloco reutilizável" onClick={() => setSaving(s)}>Salvar como bloco</button>
                </div></details>
              </div>}
              {!s.enabled ? <button className="canvas-hidden-label" onClick={() => { select({ id: s.id, kind: 'block' }); setInspector(true); }}>Bloco oculto · {blockRegistry[s.type].name}</button> : <SectionContent section={s} language={language} readOnly={readOnly} onChange={changeSection} onSelect={select} onUndo={onUndo} onRedo={onRedo} />}
            </article>{addAt(index + 1)}
          </div>)}</> : <><LegacyContent campaign={campaign} language={language} readOnly={readOnly} onChange={onChange} onSelect={select} onUndo={onUndo} onRedo={onRedo} />{addAt(editableSections.length)}</>}
          <table className="canvas-brand" role="presentation" aria-label="Rodapé fixo" onClick={event => event.preventDefault()}><tbody dangerouslySetInnerHTML={{ __html: GranistoneFooter(brand, language) }} /></table>
        </div><p className="canvas-footnote">600 px · {language.toUpperCase()} · Cabeçalho e rodapé configurados em Marca</p>
      </div>
      {inspector ? <aside className="canvas-inspector" aria-label="Propriedades do elemento"><header><strong>{selected?.kind === 'image' ? 'Imagem' : selected?.kind === 'text' ? 'Texto' : section ? blockRegistry[section.type].name : 'E-mail'}</strong><button aria-label="Recolher propriedades" title="Recolher propriedades" onClick={() => setInspector(false)}><X size={17} /></button></header><div className="canvas-panel-tabs" role="tablist" aria-label="Abas de propriedades">{([['content', 'Conteúdo'], ['style', 'Estilo'], ['advanced', 'Avançado']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={inspectorTab === key} className={inspectorTab === key ? 'active' : ''} onClick={() => setInspectorTab(key)}>{label}</button>)}</div><div className="canvas-inspector-body" inert={readOnly} aria-disabled={readOnly}>
        {selected && <p className="muted">{section ? blockRegistry[section.type].name : 'Template original'}{selected.field && section ? ' · ' + (blockRegistry[section.type].fields.find(f => f.key === selected.field)?.label ?? '') : ''}</p>}
        {inspectorTab === 'content' && <>
        {selected?.kind === 'text' && <p className="canvas-panel-context">Edite o texto diretamente na composição. Selecione um trecho para formatar.</p>}
        {imageKey && <ImagePicker key={`${selected?.id}:${imageKey}:${language}`} label={imageKey === 'image2' ? 'Imagem do bloco 2' : section ? 'Imagem do bloco' : imageKey === 'heroImage' ? 'Imagem principal' : 'Imagem de aplicação'} value={imageContent[imageKey] || ''} alt={imageContent[imageAlt] || ''} recommended={imageSize} materialId={campaign.materialId} saveState={saveState} onChange={imageChange} onAlt={imageAltChange} />}
        {section && selected?.kind === 'block' && <SectionFields section={section} language={language} onChange={changeSection} showDesign={false} />}
        {section && selected?.kind !== 'block' && blockRegistry[section.type].fields.filter(f => f.kind === 'url').map(f => <Field key={f.key} label={f.label} value={section.content[language][f.key]} onChange={event => changeSection({ ...section, content: { ...section.content, [language]: { ...section.content[language], [f.key]: event.target.value } } })} />)}
        {!section && !sections && selected && <><Field label="Link do botão" value={campaign.content[language].ctaUrl} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], ctaUrl: event.target.value } } })} />{selected?.field?.startsWith('article') && <Field label="Link do artigo" value={campaign.content[language].articleUrl} onChange={event => onChange({ content: { ...campaign.content, [language]: { ...campaign.content[language], articleUrl: event.target.value } } })} />}</>}
        {!selected && <p className="canvas-panel-context">Selecione um texto, imagem ou bloco para ver seu conteúdo.</p>}
        </>}
        {inspectorTab === 'style' && (!selected ? <><p className="canvas-panel-context">Ajustes gerais da composição.</p><BackgroundEditor label="Fundo do e-mail" value={design.email} onChange={email => onChange({ design: { ...design, email } })} /><BackgroundEditor label="Fundo do conteúdo" value={design.content} onChange={(content, textColor) => onChange({ design: { ...design, content, ...(textColor ? { textColor } : {}) } })} /><ColorField label="Cor do texto do conteúdo" value={design.textColor} onChange={textColor => onChange({ design: { ...design, textColor } })} /></> : section && selected.kind === 'text' ? <><p className="canvas-panel-context">Selecione um trecho no canvas para formatar. Ajustes abaixo afetam o bloco.</p><AlignmentControl label="Alinhamento do bloco" value={section.settings.alignment} onChange={alignment => settings({ alignment })} /><ColorField label="Cor do texto do bloco" value={section.settings.textColor} onChange={textColor => settings({ textColor })} /></> : section && selected.kind === 'block' ? <>
          <label className="field"><span>Estilo do bloco</span><select aria-label="Aplicar estilo do bloco" value="" onChange={event => {
            const presets: Record<string, Partial<Section['settings']>> = { editorial: { background: { kind: 'solid', color: '#FFFFFF' }, textColor: '#111111', padding: 36, alignment: 'left' }, mineral: { background: { kind: 'solid', color: '#F5F3EF' }, textColor: '#111111', padding: 36, alignment: 'center' }, premium: { background: { kind: 'solid', color: '#111111' }, textColor: '#FFFFFF', padding: 40, alignment: 'center' } };
            if (presets[event.target.value]) settings(presets[event.target.value]);
          }}><option value="">Escolher um estilo…</option><option value="editorial">Branco editorial</option><option value="mineral">Mineral</option><option value="premium">Preto premium</option></select></label>
          <AlignmentControl label="Alinhamento do bloco" value={section.settings.alignment} onChange={alignment => settings({ alignment })} />
          <ColorField label="Cor do texto do bloco" value={section.settings.textColor} onChange={textColor => settings({ textColor })} />
          <BackgroundEditor label="Fundo do bloco" value={section.settings.background} onChange={(background, textColor) => settings({ background, ...(textColor ? { textColor } : {}) })} />
          <label>Espaçamento interno · {section.settings.padding} px<input aria-label="Espaçamento interno" type="range" min="0" max="80" step="4" value={section.settings.padding} onChange={event => settings({ padding: Number(event.target.value) })} /></label>
        </> : selected.kind === 'image' ? <p className="canvas-panel-context">Substituição, corte e texto alternativo estão em Conteúdo.</p> : <>
          {!sections && selected && <AlignmentControl value={campaign.alignment} onChange={alignment => onChange({ alignment })} />}
          <BackgroundEditor label="Fundo do e-mail" value={design.email} onChange={email => onChange({ design: { ...design, email } })} />
          <BackgroundEditor label="Fundo do conteúdo" value={design.content} onChange={(content, textColor) => onChange({ design: { ...design, content, ...(textColor ? { textColor } : {}) } })} />
          <ColorField label="Cor do texto do conteúdo" value={design.textColor} onChange={textColor => onChange({ design: { ...design, textColor } })} />
        </>)}
        {inspectorTab === 'advanced' && <>{section ? <><label><input type="checkbox" checked={section.enabled} onChange={event => changeSection({ ...section, enabled: event.target.checked })} /> Exibir bloco</label>{section.type === 'spacer' && <label>Altura do espaçador<input aria-label="Altura do espaçador" type="range" min="8" max="200" step="4" value={section.settings.height} onChange={event => settings({ height: Number(event.target.value) })} /></label>}</> : <p className="canvas-panel-context">Configurações da composição original.</p>}<button className="button" onClick={() => onAdvanced()}>Configurações avançadas da campanha</button></>}
      </div></aside> : <div className="canvas-panel-rail right"><button aria-label="Abrir propriedades" title="Abrir propriedades" onClick={() => { setInspectorTab(selected ? selected.kind === 'block' ? 'style' : 'content' : 'style'); setInspector(true); }}><PanelRightOpen size={19} /></button></div>}
    </div>
    {saving && !readOnly && <SavedDesignDialog initial={{ kind: 'block', payload: saving }} onClose={() => setSaving(undefined)} />}
    {saved && <Modal title="Blocos Granistone" onClose={() => setSaved(false)} wide><SavedDesignLibrary kind="block" onUse={design => { if (design.kind === 'block') insert(design.payload); }} /></Modal>}
    {review && <Modal title="Revisar e publicar" onClose={onReviewClose} wide><p>Confira conteúdo e idiomas. O pré-flight completo verifica imagens, links e HTML antes da publicação.</p>{languages(campaign).map(lang => <section key={lang}><h3>{lang.toUpperCase()}</h3>{contentChecks(campaign, lang, brand).filter(c => c.severity !== 'pass').map(check => <p key={check.id} className={check.severity === 'error' ? 'alert' : 'muted'}>{check.message} {check.sectionId && <button className="text-button" onClick={() => {
      onLanguage(lang); onReviewClose();
      const s = sections?.find(s => s.id === check.sectionId), field = blockRegistry[s?.type ?? 'centeredText'].fields.find(f => f.key === check.field);
      const image = field?.kind === 'image' || field?.kind === 'alt';
      setSelected({ id: check.sectionId!, field: image ? check.field?.endsWith('2') ? 'image2' : 'image' : check.field, kind: image ? 'image' : field?.kind === 'url' ? 'block' : 'text' }); setInspector(true);
      requestAnimationFrame(() => document.querySelector(`[data-canvas-block="${check.sectionId}"]`)?.scrollIntoView({ block: 'center' }));
    }}>Localizar no e-mail</button>}</p>)}</section>)}<div className="review-actions"><button className="button" onClick={onReviewClose}>Voltar à composição</button><button className="button" onClick={() => { onReviewClose(); onFinalPreview(); }}>Ver HTML final</button><button className="button" disabled={!canExport} onClick={() => { onReviewClose(); onExport(); }}>Exportar HTML</button><button className="button primary" disabled={!canPublish} onClick={() => { onReviewClose(); onPublish(); }}>Preparar publicação</button></div></Modal>}
  </div>;
}
