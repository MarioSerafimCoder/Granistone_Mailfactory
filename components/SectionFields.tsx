'use client';
import { Field, TextArea } from './ui';
import dynamic from 'next/dynamic';
import { plainText } from '@/campaigns/model';
const RichEditor = dynamic(() => import('./MailyTextEditor'), { ssr: false });
import { blockRegistry } from '@/blocks/registry';
import type { Section } from '@/types/design';
import type { Language } from '@/types/campaign';
import ImagePicker from './ImagePicker';
import BackgroundEditor, { ColorField } from './BackgroundEditor';
import AlignmentControl from './AlignmentControl';
export default function SectionFields({ section, language, onChange }: { section: Section; language: Language; onChange: (s: Section) => void }) {
  const fields = blockRegistry[section.type].fields, c = section.content[language];
  const recommended = ['heroEditorial', 'heroProduct', 'banner'].includes(section.type) ? '1200 × 800 px'
    : ['product', 'twoProducts'].includes(section.type) ? '800 × 800 px'
      : section.type === 'gallery' ? '700 × 900 px' : '1200 × 700 px';
  const edit = (key: string, value: string) => onChange({ ...section, content: { ...section.content, [language]: { ...c, [key]: value } } });
  const settings = (patch: Partial<Section['settings']>) => onChange({ ...section, settings: { ...section.settings, ...patch } });
  return <div className="section-fields">
    {section.richBody?.[language] && <RichEditor value={section.richBody[language]} onChange={body => onChange({ ...section, content: { ...section.content, [language]: { ...c, text: plainText(body) } }, richBody: { ...section.richBody, [language]: body } })} />}
    {fields.filter(f => f.kind !== 'alt' && !(f.key === 'text' && section.richBody?.[language])).map(field => field.kind === 'image' ? <ImagePicker key={field.key} label={field.label} value={c[field.key]} alt={c[field.key === 'image2' ? 'alt2' : 'alt'] || ''} recommended={recommended} onAlt={value => edit(field.key === 'image2' ? 'alt2' : 'alt', value)} onChange={(value, alt) => {
      const content = structuredClone(section.content);
      for (const lang of ['pt', 'en', 'es'] as const) content[lang][field.key] = value;
      if (alt) content[language][field.key === 'image2' ? 'alt2' : 'alt'] = alt;
      onChange({ ...section, content });
    }} /> : field.kind === 'textarea' ? <TextArea key={field.key} label={field.label} value={c[field.key]} onChange={e => edit(field.key, e.target.value)} /> : <Field key={field.key} label={field.label} value={c[field.key]} onChange={e => edit(field.key, e.target.value)} />)}
    <BackgroundEditor label="Fundo do bloco" value={section.settings.background} onChange={(background, textColor) => settings({ background, ...(textColor ? { textColor } : {}) })} />
    <ColorField label="Cor do texto do bloco" value={section.settings.textColor} onChange={textColor => settings({ textColor })} />
    <AlignmentControl label="Alinhamento do bloco" value={section.settings.alignment} onChange={alignment => settings({ alignment })} />
    <label>Espaçamento interno · {section.settings.padding} px<input aria-label="Espaçamento interno" type="range" min="0" max="80" step="4" value={section.settings.padding} onChange={e => settings({ padding: Number(e.target.value) })} /></label>
    {section.type === 'spacer' && <label>Altura do espaçador · {section.settings.height} px<input aria-label="Altura do espaçador" type="range" min="8" max="200" step="4" value={section.settings.height} onChange={e => settings({ height: Number(e.target.value) })} /></label>}
  </div>;
}
