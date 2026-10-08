'use client';
import type { CSSProperties, ReactNode } from 'react';
import type { Campaign, Language } from '@/types/campaign';
import type { Background, Section } from '@/types/design';
import { blockRegistry } from '@/blocks/registry';
import { fieldDocument, updateLegacyText, updateSectionText } from '@/lib/canvas-model';
import { resolveBackground } from '@/lib/tokens/backgrounds';
import { safeUrl } from '@/lib/safety';
import InlineText from './InlineText';

export type CanvasSelection = { id: string; field?: string; kind: 'block' | 'text' | 'image' };
export function backgroundStyle(background?: Background): CSSProperties {
  if (!background) return {};
  const b = resolveBackground(background);
  if (b.kind === 'none') return {};
  if (b.kind === 'solid') return { background: b.color };
  if (b.kind === 'gradient') return { backgroundColor: b.fallback, backgroundImage: `linear-gradient(${b.direction === 'horizontal' ? 'to right' : b.direction === 'diagonal' ? '135deg' : 'to bottom'}, ${b.start}, ${b.end})` };
  const url = safeUrl(b.image, true);
  return { backgroundColor: b.fallback, ...(url ? { backgroundImage: `linear-gradient(rgba(0,0,0,${b.overlay}),rgba(0,0,0,${b.overlay})),url(${JSON.stringify(url)})` } : {}), backgroundSize: b.size === 'original' ? 'auto' : b.size, backgroundPosition: `${b.align ?? 'center'} ${b.position}`, backgroundRepeat: b.repeat ?? 'no-repeat' };
}
function Picture({ src, alt, label, readOnly, onClick }: { src: string; alt: string; label: string; readOnly: boolean; onClick: () => void }) {
  return <button className="canvas-picture" type="button" disabled={readOnly} aria-label={`Editar ${label}`} onClick={event => { event.stopPropagation(); onClick(); }}>
    {safeUrl(src, true) ? <img src={safeUrl(src, true)} alt={alt} /> : <span className="canvas-photo-empty">＋<small>Adicionar fotografia</small></span>}
    {!readOnly && <span className="canvas-picture-hint">Substituir · biblioteca · corte</span>}
  </button>;
}
export function SectionContent({ section, language, readOnly, onChange, onSelect, onUndo, onRedo }: {
  section: Section; language: Language; readOnly: boolean; onChange: (s: Section, group?: string) => void; onSelect: (s: CanvasSelection) => void; onUndo: () => void; onRedo: () => void;
}) {
  const c = section.content[language];
  const text = (key: string, kind: 'title' | 'text' | 'button' = 'text') => {
    const label = blockRegistry[section.type].fields.find(f => f.key === key)?.label ?? key;
    // Legacy richBody remains authoritative for converted editorial paragraphs.
    const rich = key === 'text' ? section.richBody?.[language] ?? section.richFields?.[language]?.[key] : section.richFields?.[language]?.[key];
    const value = key === 'text' && section.richBody?.[language] ? rich! : fieldDocument(c[key] ?? '', rich);
    const supportsBody = key === 'text' && ['centeredText', 'heroEditorial', 'heroProduct', 'imageText', 'textImage', 'product', 'cta', 'complementaryFooter'].includes(section.type);
    return <InlineText key={key + language} label={label} kind={supportsBody ? 'body' : kind} value={value} readOnly={readOnly}
      onSelect={() => onSelect({ id: section.id, field: key, kind: 'text' })} onUndo={onUndo} onRedo={onRedo}
      onChange={value => { const next = updateSectionText(section, language, key, value); if (supportsBody) next.richBody = { ...next.richBody, [language]: value }; onChange(next, `${section.id}:${language}:${key}`); }} />;
  };
  const image = (suffix = '') => <Picture src={c['image' + suffix] || ''} alt={c['alt' + suffix] || ''} label={suffix ? 'Imagem do bloco 2' : 'Imagem do bloco'} readOnly={readOnly} onClick={() => onSelect({ id: section.id, field: 'image' + suffix, kind: 'image' })} />;
  const copy = (suffix = '') => <>{text('title' + suffix, 'title')}{text('text' + suffix)}</>;
  const button = (suffix = '') => <div className="canvas-cta" style={{ textAlign: section.settings.alignment }}>{text('label' + suffix, 'button')}</div>;
  const columns = (a: ReactNode, b: ReactNode) => <div className="canvas-columns"><div>{a}</div><div>{b}</div></div>;
  let content: ReactNode;
  switch (section.type) {
    case 'heroEditorial': content = <>{image()}{copy()}</>; break;
    case 'heroProduct': case 'product': content = <>{image()}{copy()}{button()}</>; break;
    case 'imageText': content = columns(image(), <>{copy()}{button()}</>); break;
    case 'textImage': content = columns(<>{copy()}{button()}</>, image()); break;
    case 'twoProducts': content = columns(<>{image()}{copy()}{button()}</>, <>{image('2')}{copy('2')}{button('2')}</>); break;
    case 'gallery': content = <>{columns(image(), image('2'))}{text('text')}</>; break;
    case 'banner': content = <>{image()}{button()}</>; break;
    case 'cta': content = <>{copy()}{button()}</>; break;
    case 'divider': content = <hr />; break;
    case 'spacer': content = <div className="canvas-spacer" style={{ height: section.settings.height }}><span>Espaçador · {section.settings.height} px</span></div>; break;
    case 'quote': content = <blockquote>{text('text')}{text('title')}</blockquote>; break;
    default: content = copy();
  }
  return <div className={`canvas-section-content canvas-type-${section.type}`} style={{ ...backgroundStyle(section.settings.background), color: section.settings.textColor, padding: section.settings.padding, textAlign: section.settings.alignment }}>{content}</div>;
}

export function LegacyContent({ campaign, language, readOnly, onChange, onSelect, onUndo, onRedo }: {
  campaign: Campaign; language: Language; readOnly: boolean; onChange: (patch: Partial<Campaign>, group?: string) => void; onSelect: (s: CanvasSelection) => void; onUndo: () => void; onRedo: () => void;
}) {
  const c = campaign.content[language];
  const has = (id: string) => campaign.blocks.some(b => b.id === id && b.enabled);
  const text = (field: string, label: string, kind: 'title' | 'text' | 'body' | 'button' | 'kicker' = 'text') => <InlineText key={field + language} label={label} kind={kind} links={field !== 'articleTitle' && kind !== 'button'} readOnly={readOnly}
    value={field === 'body' ? c.body : fieldDocument(String(c[field as keyof typeof c] ?? ''), campaign.richFields?.[language]?.[field])}
    onSelect={() => onSelect({ id: 'legacy', field, kind: 'text' })} onUndo={onUndo} onRedo={onRedo} onChange={value => onChange(updateLegacyText(campaign, language, field, value), `legacy:${language}:${field}`)} />;
  const photo = (slot: 'hero' | 'application') => has(slot) ? <Picture src={c[slot === 'hero' ? 'heroImage' : 'applicationImage']} alt={c[slot === 'hero' ? 'heroAlt' : 'applicationAlt']} label={slot === 'hero' ? 'Imagem principal' : 'Imagem de aplicação'} readOnly={readOnly} onClick={() => onSelect({ id: 'legacy', field: slot === 'hero' ? 'heroImage' : 'applicationImage', kind: 'image' })} /> : null;
  const heading = (align = campaign.alignment) => <div className="canvas-legacy-heading" style={{ textAlign: align }}>{text('kicker', 'Chamada', 'kicker')}{campaign.template === 'product-architect' && <div className="canvas-material-heading">{text('materialName', 'Material', 'title')}</div>}{text('headline', 'Título', 'title')}{text('subheadline', 'Subtítulo')}</div>;
  const body = has('body') ? text('body', 'Texto editorial', 'body') : null;
  const button = has('cta') ? <div className={`canvas-cta ${campaign.template === 'product-commercial' || campaign.template === 'newsletter' ? 'filled' : ''}`}>{text('cta', 'Texto do botão', 'button')}</div> : null;
  const featureLabel = language === 'en' ? 'FEATURES' : campaign.template === 'product-commercial' ? language === 'es' ? 'DIFERENCIALES' : 'DIFERENCIAIS' : 'CARACTERÍSTICAS';
  const applicationLabel = language === 'en' ? 'APPLICATIONS' : language === 'es' ? 'APLICACIONES' : 'APLICAÇÕES';
  const specs = has('specs') ? campaign.template === 'product-commercial' ? <div className="canvas-commercial-specs">{text('materialName', 'Material', 'title')}<div className="canvas-spec-columns"><div><small>{featureLabel}</small>{text('features', 'Características')}</div><div><small>{applicationLabel}</small>{text('applications', 'Aplicações')}</div></div></div> : <div className="canvas-specs">{campaign.template !== 'product-architect' && text('materialName', 'Material', 'title')}<small>{featureLabel}</small>{text('features', 'Características')}<small>{applicationLabel}</small>{text('applications', 'Aplicações')}</div> : null;
  const row = (node: ReactNode, full = false) => node ? <div className={`canvas-legacy-row${full ? ' full' : ''}`}>{node}</div> : null;
  const columns = (a: ReactNode, b: ReactNode) => <div className="canvas-columns"><div>{a}</div><div>{b}</div></div>;
  let content: ReactNode;
  switch (campaign.template) {
    case 'institutional': content = <>{row(photo('hero'), true)}{row(heading('center'))}{row(body)}{row(button)}</>; break;
    case 'product-architect': content = <>{row(photo('hero'))}{row(heading())}{row(body)}{row(columns(photo('application'), specs))}{row(button)}</>; break;
    case 'product-commercial': content = <>{row(columns(photo('hero'), <>{heading()}{body}{button}</>))}{row(specs)}{has('availability') && row(<div className="canvas-availability"><small>{language === 'en' ? 'COMMERCIAL AVAILABILITY' : language === 'es' ? 'DISPONIBILIDAD COMERCIAL' : 'DISPONIBILIDADE COMERCIAL'}</small>{text('availability', 'Disponibilidade')}</div>)}</>; break;
    case 'notice': content = <>{row(heading(campaign.alignment === 'left' ? 'center' : campaign.alignment))}{row(photo('hero'))}{row(<div className="canvas-notice" style={{ textAlign: campaign.alignment === 'left' ? 'center' : campaign.alignment }}>{body}</div>)}</>; break;
    default: {
      const modules: Record<string, ReactNode> = { hero: photo('hero'), application: photo('application'), body, specs, cta: button };
      for (const field of ['article', 'event', 'project']) modules[field] = <><hr />{text(field + 'Title', field === 'article' ? 'Título do artigo' : field === 'event' ? 'Título do evento' : 'Título do projeto', 'title')}{text(field + 'Text', field === 'article' ? 'Texto do artigo' : field === 'event' ? 'Texto do evento' : 'Texto do projeto')}</>;
      const blocks = campaign.blocks.filter(b => b.enabled), rows: ReactNode[] = [];
      for (let i = 0; i < blocks.length; i++) {
        const id = blocks[i].id, next = blocks[i + 1]?.id;
        const paired = (id === 'application' && next === 'article') || (id === 'event' && next === 'project');
        rows.push(<div key={id}>{row(paired ? columns(modules[id], modules[next]) : modules[id])}</div>);
        if (paired) i++;
      }
      content = <>{row(heading('left'))}{rows}</>;
    }
  }
  return <div className={`canvas-legacy template-${campaign.template}`} style={{ textAlign: campaign.alignment }}>{content}</div>;
}
