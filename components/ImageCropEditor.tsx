'use client';
import { useEffect, useRef, useState } from 'react';
import { Crop, RotateCcw } from 'lucide-react';
import { online } from '@/lib/online';
import { Modal } from './ui';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function ImageCropEditor({ src, alt, width, height, onApply, onClose }: {
  src: string; alt: string; width: number; height: number;
  onApply: (url: string) => void; onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1); const [x, setX] = useState(50); const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number } | null>(null);
  const source = loaded?.src === src ? loaded.image : undefined;
  const scale = source ? Math.max(width / source.naturalWidth, height / source.naturalHeight) * zoom : 1;
  const overflowX = source ? source.naturalWidth * scale - width : 0;
  const overflowY = source ? source.naturalHeight * scale - height : 0;

  useEffect(() => {
    let cancelled = false;
    const next = new Image(); next.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => { if (!cancelled) { next.src = ''; setError('A imagem demorou para abrir. Feche o recorte e tente novamente.'); } }, 20000);
    next.onload = () => { clearTimeout(timeout); if (!cancelled) { setLoaded({ src, image: next }); setError(''); } };
    next.onerror = () => { clearTimeout(timeout); if (!cancelled) setError('Não foi possível abrir esta imagem para recorte. Envie-a pela aba Computador ou escolha uma foto da biblioteca.'); };
    next.src = src;
    return () => { cancelled = true; clearTimeout(timeout); next.onload = null; next.onerror = null; };
  }, [src]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !source) return;
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(source, -overflowX * x / 100, -overflowY * y / 100, source.naturalWidth * scale, source.naturalHeight * scale);
  }, [source, width, height, scale, overflowX, overflowY, x, y]);

  async function save() {
    if (!source || !canvas.current || busy) return;
    setBusy(true); setError('');
    try {
      const output = canvas.current;
      const context = output.getContext('2d');
      if (!context) throw new Error('O editor de imagem não está disponível neste navegador.');
      const pixels = context.getImageData(0, 0, width, height).data;
      let transparent = false;
      for (let index = 3; index < pixels.length; index += 4) { if (pixels[index] < 255) { transparent = true; break; } }
      const mime = transparent ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, mime, .94));
      if (!blob) throw new Error('Não foi possível gerar o recorte.');
      const asset = await online.assets.upload(blob, { fileName: `recorte-${width}x${height}.${transparent ? 'png' : 'jpg'}`, name: `${alt || 'Imagem'} · recorte`, alt, category: 'outro' });
      onApply(asset.url); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o recorte. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Editar corte da imagem" onClose={() => { if (!busy) onClose(); }} wide>
    <div className="crop-layout">
      <div><div className={`crop-stage${source ? ' ready' : ''}`} style={{ aspectRatio: `${width}/${height}` }}>
        <canvas ref={canvas} width={width} height={height} tabIndex={source && !busy ? 0 : -1} role="img" aria-label="Prévia do recorte. Arraste a imagem ou use as setas para ajustar." aria-describedby="crop-instructions"
          onPointerDown={event => {
            if (!source || busy || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y };
          }}
          onPointerMove={event => {
            const start = drag.current; if (!start || start.id !== event.pointerId || busy) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (overflowX > .01) setX(clamp(start.x - (event.clientX - start.clientX) * width / bounds.width / overflowX * 100));
            if (overflowY > .01) setY(clamp(start.y - (event.clientY - start.clientY) * height / bounds.height / overflowY * 100));
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={event => {
            if (!source || busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); const step = event.shiftKey ? 10 : 2;
            if (overflowX > .01 && event.key === 'ArrowLeft') setX(value => clamp(value + step));
            if (overflowX > .01 && event.key === 'ArrowRight') setX(value => clamp(value - step));
            if (overflowY > .01 && event.key === 'ArrowUp') setY(value => clamp(value + step));
            if (overflowY > .01 && event.key === 'ArrowDown') setY(value => clamp(value - step));
          }} />
        {!source && <span role="status">{error ? 'Prévia indisponível' : 'Carregando imagem…'}</span>}
        {source && <div className="crop-guides" aria-hidden="true" />}
      </div><p className="muted" id="crop-instructions">Arraste a imagem para enquadrar. Use o zoom para aproximar os detalhes.</p></div>
      <div className="crop-controls"><div className="crop-note"><Crop size={20} /><div><strong>{width} × {height} px</strong><p>O recorte será salvo como uma nova imagem e aplicado ao e-mail. A foto original será preservada.</p></div></div>
        <fieldset disabled={busy || !source}>
          <label>Zoom · {Math.round(zoom * 100)}%<input aria-label="Zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
          <label>Posição horizontal · {Math.round(x)}%<input aria-label="Posição horizontal" type="range" min="0" max="100" value={x} disabled={overflowX < .01} onChange={event => setX(Number(event.target.value))} /></label>
          <label>Posição vertical · {Math.round(y)}%<input aria-label="Posição vertical" type="range" min="0" max="100" value={y} disabled={overflowY < .01} onChange={event => setY(Number(event.target.value))} /></label>
          <button className="button" type="button" onClick={() => { setZoom(1); setX(50); setY(50); }}><RotateCcw size={14} /> Redefinir recorte</button>
        </fieldset>
      </div>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className="button primary" onClick={() => void save()} disabled={busy || !source}>{busy ? 'Salvando…' : 'Salvar recorte'}</button></div>
  </Modal>;
}
