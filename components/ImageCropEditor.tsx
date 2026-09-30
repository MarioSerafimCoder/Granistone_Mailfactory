'use client';
import { useEffect, useRef, useState } from 'react';
import { Crop } from 'lucide-react';
import { online } from '@/lib/online';
import { Modal } from './ui';

export default function ImageCropEditor({ src, alt, width, height, onApply, onClose }: {
  src: string; alt: string; width: number; height: number;
  onApply: (url: string) => void; onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1); const [x, setX] = useState(50); const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const image = useRef<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    const next = new Image(); next.crossOrigin = 'anonymous'; next.src = src;
    next.onload = () => { image.current = next; };
    next.onerror = () => setError('Não foi possível abrir esta imagem para recorte. Hospede-a na biblioteca e tente novamente.');
  }, [src]);
  async function save() {
    if (!image.current) return; setBusy(true); setError('');
    try {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); if (!context) throw new Error('O editor de imagem não está disponível neste navegador.');
      const source = image.current; const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight) * zoom;
      const drawWidth = source.naturalWidth * scale; const drawHeight = source.naturalHeight * scale;
      const left = -(drawWidth - width) * (x / 100); const top = -(drawHeight - height) * (y / 100);
      context.drawImage(source, left, top, drawWidth, drawHeight);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
      if (!blob) throw new Error('Não foi possível gerar o recorte.');
      const asset = await online.assets.upload(blob, { fileName: `recorte-${width}x${height}.jpg`, name: alt || 'Imagem recortada', alt, category: 'outro' });
      onApply(asset.url); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o recorte.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Editar corte da imagem" onClose={onClose} wide>
    <div className="crop-layout">
      <div className="crop-stage" style={{ aspectRatio: `${width}/${height}` }}><img src={src} alt={alt} style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, objectPosition: `${x}% ${y}%` }} /></div>
      <div className="crop-controls"><div className="crop-note"><Crop size={20} /><div><strong>Formato final: {width} × {height} px</strong><p>A imagem recortada será salva na biblioteca e aplicada ao e-mail.</p></div></div>
        <label>Zoom <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <label>Posição horizontal <input type="range" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
        <label>Posição vertical <input type="range" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
      </div>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" onClick={() => void save()} disabled={busy || !!error}>{busy ? 'Salvando…' : 'Salvar recorte'}</button></div>
  </Modal>;
}
