'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, Link as LinkIcon, Images, Crop } from 'lucide-react';
import { Field } from './ui';
import { prepareImage } from '@/lib/images';
import { uploadLocalImage } from '@/lib/online';
import AssetLibrary from './AssetLibrary';
import ImageCropEditor from './ImageCropEditor';

export default function ImagePicker({ label, value, alt, recommended, materialId, onChange, onAlt }: {
  label: string; value: string; alt: string; recommended: string; materialId?: string;
  onChange: (value: string) => void; onAlt: (value: string) => void;
}) {
  const [error, setError] = useState('');
  const [cropOpen, setCropOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'library' | 'file' | 'web'>('library');
  const [url, setUrl] = useState(value.startsWith('http') ? value : '');
  const [feedback, setFeedback] = useState('');
  const [broken, setBroken] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const apply = useRef(onChange);
  useEffect(() => { apply.current = onChange; }, [onChange]);
  useEffect(() => () => { revision.current++; }, []);
  async function upload(file?: File) {
    if (!file || busy) return;
    const request = ++revision.current;
    setError(''); setBusy(true); setFeedback('');
    try {
      const prepared = await prepareImage(file);
      if (request !== revision.current) return;
      apply.current(prepared); setBroken(false);
      setFeedback(`${file.name} · imagem pronta`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a imagem.');
    } finally { setBusy(false); }
  }
  async function applyUrl() {
    setError(''); setFeedback('');
    try {
      const parsed = new URL(url.trim());
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
    } catch { setError('Cole o endereço completo da imagem, começando com https://.'); return; }
    setBusy(true);
    const request = ++revision.current;
    const candidate = new Image();
    candidate.referrerPolicy = 'no-referrer';
    const timeout = setTimeout(() => { candidate.src = ''; }, 15000);
    try {
      candidate.src = url.trim();
      await candidate.decode();
      if (request !== revision.current) return;
      apply.current(url.trim()); setBroken(false); setFeedback('Imagem da web aplicada.');
    } catch { setError('Este endereço não abriu uma imagem. Copie o link direto da imagem ou baixe o arquivo para o computador.'); }
    finally { clearTimeout(timeout); setBusy(false); }
  }
  return <div className="image-field image-picker">
    <strong>{label}</strong>
    <div className="image-source-tabs">
      <button type="button" disabled={busy} className={mode === 'library' ? 'active' : ''} onClick={() => setMode('library')}><Images size={14} /> Biblioteca</button>
      <button type="button" disabled={busy} className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}><Upload size={14} /> Computador</button>
      <button type="button" disabled={busy} className={mode === 'web' ? 'active' : ''} onClick={() => setMode('web')}><LinkIcon size={14} /> Link da web</button>
    </div>
    {mode === 'library' ? <AssetLibrary embedded lazy materialId={materialId} preferredOrientation="horizontal" onSelect={asset => { onChange(asset.url); if (!alt && asset.alt) onAlt(asset.alt); setFeedback('Imagem da biblioteca aplicada.'); }} /> : mode === 'file' ? <button type="button" className="image-dropzone" disabled={busy}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files[0]); }}
      onClick={() => input.current?.click()}>
      {value && !broken ? <img src={value} alt={alt || label} onError={() => setBroken(true)} /> : <ImagePlus size={28} />}
      <span>{busy ? 'Preparando imagem…' : value ? 'Clique para trocar a imagem' : 'Clique ou arraste uma imagem aqui'}</span>
      <small>JPG, PNG ou WebP até 20 MB · GIF até 1 MB</small>
    </button> : <div className="image-web-input">
      <Field label={`URL · ${label.toLowerCase()}`} value={url} placeholder="https://site.com/imagem.jpg" onChange={(event) => setUrl(event.target.value)} />
      <button type="button" className="button" disabled={busy || !url.trim()} onClick={() => void applyUrl()}>{busy ? 'Verificando…' : 'Usar imagem da web'}</button>
      {value && <img className="image-web-preview" src={value} alt={alt || label} />}
    </div>}
    <input ref={input} type="file" className="sr-only" aria-label={`Carregar ${label.toLowerCase()}`} accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy}
      onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    <small className="image-hint">{recommended} · Compartilhada entre PT, EN e ES. Fotos grandes são otimizadas automaticamente.</small>
    <div className="actions">
      {value && <button type="button" className="text-button" disabled={busy} onClick={() => setCropOpen(true)}><Crop size={14} /> Editar corte e tamanho</button>}
      {value.startsWith('data:') && <button type="button" className="text-button" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { const asset = await uploadLocalImage(value, alt); onChange(asset.url); setFeedback('Imagem hospedada com URL pública.'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Upload indisponível.'); }
        finally { setBusy(false); }
      }}>Hospedar esta imagem</button>}
    </div>
    {cropOpen && <ImageCropEditor src={value} alt={alt} width={Number(recommended.match(/\d+/)?.[0]) || 1200} height={Number(recommended.match(/×\s*(\d+)/)?.[1]) || 700} onApply={onChange} onClose={() => setCropOpen(false)} />}
    {value && <button type="button" className="text-button" disabled={busy} onClick={() => { revision.current++; onChange(''); setFeedback(''); setUrl(''); }}>Remover imagem</button>}
    <Field label={`Texto alternativo · ${label.toLowerCase()}`} value={alt} placeholder="Descreva o que aparece na imagem" onChange={(event) => onAlt(event.target.value)} />
    {error && <p role="alert" className="alert">{error}</p>}
    {feedback && <p role="status" className="image-feedback">{feedback}</p>}
  </div>;
}
