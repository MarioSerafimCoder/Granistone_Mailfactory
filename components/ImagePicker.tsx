'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, Link as LinkIcon } from 'lucide-react';
import { Field } from './ui';
import { prepareImage } from '@/lib/images';
import { uploadLocalImage } from '@/lib/online';
import AssetLibrary from './AssetLibrary';

export default function ImagePicker({ label, value, alt, recommended, onChange, onAlt }: {
  label: string; value: string; alt: string; recommended: string;
  onChange: (value: string) => void; onAlt: (value: string) => void;
}) {
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'file' | 'web'>('file');
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
      <button type="button" disabled={busy} className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}><Upload size={14} /> Computador</button>
      <button type="button" disabled={busy} className={mode === 'web' ? 'active' : ''} onClick={() => setMode('web')}><LinkIcon size={14} /> Link da web</button>
    </div>
    {mode === 'file' ? <button type="button" className="image-dropzone" disabled={busy}
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
    <small className="image-hint">{recommended} · Compartilhada entre PT e EN. Fotos grandes são otimizadas automaticamente.</small>
    <div className="actions">
      <button type="button" className="text-button" disabled={busy} onClick={() => setLibraryOpen(true)}>Escolher da biblioteca online</button>
      {value.startsWith('data:') && <button type="button" className="text-button" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { const asset = await uploadLocalImage(value, alt); onChange(asset.url); setFeedback('Imagem hospedada com URL pública.'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Upload indisponível.'); }
        finally { setBusy(false); }
      }}>Hospedar esta imagem</button>}
    </div>
    {libraryOpen && <AssetLibrary onClose={() => setLibraryOpen(false)} onSelect={asset => { onChange(asset.url); setLibraryOpen(false); }} />}
    {value && <button type="button" className="text-button" disabled={busy} onClick={() => { revision.current++; onChange(''); setFeedback(''); setUrl(''); }}>Remover imagem</button>}
    <Field label={`Texto alternativo · ${label.toLowerCase()}`} value={alt} placeholder="Descreva o que aparece na imagem" onChange={(event) => onAlt(event.target.value)} />
    {error && <p role="alert" className="alert">{error}</p>}
    {feedback && <p role="status" className="image-feedback">{feedback}</p>}
  </div>;
}
