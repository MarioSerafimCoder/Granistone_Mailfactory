'use client';
import { useState, type CSSProperties } from 'react';
import { Field, Select } from './ui';
import ImagePicker from './ImagePicker';
import type { Background } from '@/types/design';
import { backgroundPresets, backgroundColors, resolveBackground, colorValid } from '@/lib/tokens/backgrounds';
import { safeUrl } from '@/lib/safety';
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <div className="design-color"><label>{label}<input type="color" aria-label={label} value={colorValid(value) ? value : backgroundColors.white} onChange={e => { setDraft(null); onChange(e.target.value); }} /></label><Field label={label + ' · hexadecimal'} value={draft ?? value} maxLength={7} onBlur={() => setDraft(null)} onChange={e => { setDraft(e.target.value); if (colorValid(e.target.value)) onChange(e.target.value); }} /></div>;
}
function previewStyle(value: Background): CSSProperties {
  const b = resolveBackground(value);
  if (b.kind === 'none') return {};
  if (b.kind === 'solid') return { backgroundColor: b.color };
  if (b.kind === 'gradient') return { backgroundColor: b.fallback, backgroundImage: `linear-gradient(${{ vertical: '180deg', horizontal: '90deg', diagonal: '135deg' }[b.direction]}, ${b.start}, ${b.end})` };
  const url = safeUrl(b.image, true);
  return { backgroundColor: b.fallback, ...(url ? { backgroundImage: `${b.overlay ? `linear-gradient(rgba(0,0,0,${b.overlay}),rgba(0,0,0,${b.overlay})),` : ''}url("${url.replace(/"/g, '%22')}")`, backgroundSize: b.size === 'original' ? 'auto' : b.size, backgroundPosition: `${b.align ?? 'center'} ${b.position}`, backgroundRepeat: b.repeat ?? 'no-repeat' } : {}) };
}
export default function BackgroundEditor({ label, value, onChange }: { label: string; value: Background; onChange: (b: Background, textColor?: string) => void }) {
  const b = resolveBackground(value);
  return <details className="background-editor"><summary>{label}</summary>
    <div className="background-preview" style={previewStyle(value)} role="img" aria-label={`Prévia de ${label.toLowerCase()}`}><span>{b.kind === 'none' ? 'Sem background' : b.kind === 'image' && !b.image ? 'Escolha uma imagem' : 'Prévia do fundo'}</span></div>
    <Select label={label + ' · tipo'} value={value.kind} onChange={e => {
      const kind = e.target.value;
      onChange(kind === 'none' ? { kind } : kind === 'preset' ? { kind, preset: 'white' } : kind === 'solid' ? { kind, color: backgroundColors.white } : kind === 'gradient' ? { kind, start: backgroundColors.black, end: backgroundColors.graphite, direction: 'vertical', fallback: backgroundColors.black } : { kind: 'image', image: '', size: 'cover', position: 'center', align: 'center', repeat: 'no-repeat', fallback: backgroundColors.stone, overlay: 0 });
    }}><option value="none">Nenhum</option><option value="preset">Preset Granistone</option><option value="solid">Cor sólida</option><option value="gradient">Gradiente</option><option value="image">Imagem</option></Select>
    {value.kind === 'preset' && <Select label="Backgrounds Granistone" value={value.preset} onChange={e => {
      const preset = backgroundPresets[e.target.value];
      onChange(e.target.value === 'material' ? structuredClone(preset.background) : { kind: 'preset', preset: e.target.value }, preset.textColor);
    }}>{Object.entries(backgroundPresets).map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}</Select>}
    {value.kind === 'preset' && <div className="background-presets" role="group" aria-label="Presets de background">{Object.entries(backgroundPresets).map(([key, preset]) => <button type="button" className={value.preset === key ? 'selected' : ''} aria-pressed={value.preset === key} key={key} onClick={() => onChange(key === 'material' ? structuredClone(preset.background) : { kind: 'preset', preset: key }, preset.textColor)}><span className="background-preset-swatch" style={previewStyle(preset.background)} /><span>{preset.name}</span></button>)}</div>}
    {value.kind === 'solid' && <><ColorField label={label + ' · cor'} value={value.color} onChange={color => onChange({ ...value, color })} /><div className="color-presets">{Object.entries(backgroundColors).map(([key, color]) => <button key={key} type="button" title={color} aria-label={label + ' ' + color} style={{ backgroundColor: color }} onClick={() => onChange({ ...value, color })} />)}</div></>}
    {value.kind === 'gradient' && <><ColorField label="Cor inicial" value={value.start} onChange={start => onChange({ ...value, start })} /><ColorField label="Cor final" value={value.end} onChange={end => onChange({ ...value, end })} /><Select label="Direção do gradiente" value={value.direction} onChange={e => onChange({ ...value, direction: e.target.value as typeof value.direction })}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="diagonal">Diagonal</option></Select></>}
    {value.kind === 'image' && <><ImagePicker label="Imagem de background" value={value.image} alt="" recommended="1200 × 800 px" onAlt={() => {}} onChange={image => onChange({ ...value, image })} /><div className="background-image-controls"><Select label="Ajuste da imagem" value={value.size} onChange={e => onChange({ ...value, size: e.target.value as typeof value.size })}><option value="cover">Preencher (cover)</option><option value="contain">Conter (contain)</option><option value="original">Tamanho original</option></Select><Select label="Posição horizontal" value={value.align ?? 'center'} onChange={e => onChange({ ...value, align: e.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></Select><Select label="Posição do background" value={value.position} onChange={e => onChange({ ...value, position: e.target.value as typeof value.position })}><option value="center">Centro</option><option value="top">Topo</option><option value="bottom">Base</option></Select><Select label="Repetição da imagem" value={value.repeat ?? 'no-repeat'} onChange={e => onChange({ ...value, repeat: e.target.value as 'repeat' | 'no-repeat' })}><option value="no-repeat">Não repetir</option><option value="repeat">Repetir</option></Select></div><label>Overlay escuro · {Math.round(value.overlay * 100)}%<input aria-label="Overlay escuro" type="range" min="0" max="0.8" step="0.05" value={value.overlay} onChange={e => onChange({ ...value, overlay: Number(e.target.value) })} /></label></>}
    {(value.kind === 'gradient' || value.kind === 'image') && <ColorField label="Cor de fallback" value={value.fallback} onChange={fallback => onChange({ ...value, fallback })} />}
    {b.kind !== 'solid' && <p className="muted">Alguns clientes, incluindo Outlook desktop, podem mostrar somente a cor de fallback. Revise o contraste sem a imagem ou o gradiente.</p>}
  </details>;
}
