'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Check, Crop, RotateCcw } from 'lucide-react';
import { baseCropRect, cropControlsFromRect, cropHandles, cropOutputSize, cropRectFromControls, fitCropRectToRatio, moveCropRect, resizeCropRect, type CropHandle, type CropRect } from '@/lib/image-crop';
import { online } from '@/lib/online';
import { Modal } from './ui';

const handleLabels: Record<CropHandle, string> = {
  nw: 'Arrastar canto superior esquerdo', n: 'Arrastar borda superior', ne: 'Arrastar canto superior direito',
  e: 'Arrastar borda direita', se: 'Arrastar canto inferior direito', s: 'Arrastar borda inferior',
  sw: 'Arrastar canto inferior esquerdo', w: 'Arrastar borda esquerda',
};
type Drag = { id: number; kind: 'selection' | 'preview'; handle?: CropHandle; clientX: number; clientY: number; rect: CropRect };

function drawPreview(output: HTMLCanvasElement, image: HTMLImageElement, crop: CropRect, width: number, height: number) {
  const context = output.getContext('2d');
  if (!context) throw new Error('O editor de imagem não está disponível neste navegador.');
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, width, height);
  return context;
}

export default function ImageCropEditor({ src, alt, width, height, onApply, onClose }: {
  src: string; alt: string; width: number; height: number;
  onApply: (url: string) => void; onClose: () => void;
}) {
  const [aspectLocked, setAspectLocked] = useState(true);
  const [selection, setSelection] = useState<{ src: string; rect: CropRect }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const source = loaded?.src === src ? loaded.image : undefined;
  const sourceWidth = source?.naturalWidth ?? 1;
  const sourceHeight = source?.naturalHeight ?? 1;
  const rect = selection?.src === src ? selection.rect : baseCropRect(sourceWidth, sourceHeight, width, height);
  const ratioWidth = aspectLocked ? width : rect.width;
  const ratioHeight = aspectLocked ? height : rect.height;
  const { zoom, x, y } = cropControlsFromRect(rect, sourceWidth, sourceHeight, ratioWidth, ratioHeight);
  const outputSize = cropOutputSize(rect, width, height, aspectLocked);
  const overflowX = sourceWidth - rect.width;
  const overflowY = sourceHeight - rect.height;

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
    if (source && canvas.current) drawPreview(canvas.current, source, rect, outputSize.width, outputSize.height);
  }, [source, rect, outputSize.width, outputSize.height]);

  function applyRect(next: CropRect) {
    setSelection({ src, rect: next });
  }

  function changeControl(nextZoom: number, nextX: number, nextY: number) {
    applyRect(cropRectFromControls(sourceWidth, sourceHeight, ratioWidth, ratioHeight, nextZoom, nextX, nextY));
  }

  function toggleAspectRatio() {
    if (aspectLocked) { setAspectLocked(false); return; }
    const fitted = fitCropRectToRatio(rect, width, height);
    const controls = cropControlsFromRect(fitted, sourceWidth, sourceHeight, width, height);
    applyRect(cropRectFromControls(sourceWidth, sourceHeight, width, height, controls.zoom, controls.x, controls.y));
    setAspectLocked(true);
  }

  function beginDrag(event: PointerEvent<HTMLElement>, kind: Drag['kind']) {
    if (!source || busy || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const handle = kind === 'selection' ? target.closest<HTMLElement>('[data-crop-handle]')?.dataset.cropHandle as CropHandle | undefined : undefined;
    if (kind === 'selection' && !handle && !target.closest('.crop-selection')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, kind, handle, clientX: event.clientX, clientY: event.clientY, rect };
    event.preventDefault();
  }

  function continueDrag(event: PointerEvent<HTMLElement>, kind: Drag['kind']) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || start.kind !== kind || busy) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - start.clientX, dy = event.clientY - start.clientY;
    if (kind === 'preview') {
      applyRect(moveCropRect(start.rect, -dx / bounds.width * start.rect.width, -dy / bounds.height * start.rect.height, sourceWidth, sourceHeight));
    } else {
      const sourceDx = dx / bounds.width * sourceWidth, sourceDy = dy / bounds.height * sourceHeight;
      applyRect(start.handle
        ? resizeCropRect(start.rect, start.handle, sourceDx, sourceDy, sourceWidth, sourceHeight, width, height, aspectLocked)
        : moveCropRect(start.rect, sourceDx, sourceDy, sourceWidth, sourceHeight));
    }
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  function onSelectionKey(event: KeyboardEvent<HTMLElement>, handle?: CropHandle) {
    if (!source || busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = (event.shiftKey ? 5 : 1) / 100;
    const dx = event.key === 'ArrowLeft' ? -sourceWidth * step : event.key === 'ArrowRight' ? sourceWidth * step : 0;
    const dy = event.key === 'ArrowUp' ? -sourceHeight * step : event.key === 'ArrowDown' ? sourceHeight * step : 0;
    applyRect(handle
      ? resizeCropRect(rect, handle, dx, dy, sourceWidth, sourceHeight, width, height, aspectLocked)
      : moveCropRect(rect, dx, dy, sourceWidth, sourceHeight));
  }

  async function save() {
    if (!source || !canvas.current || busy) return;
    setBusy(true); setError('');
    try {
      const output = canvas.current;
      const pixels = drawPreview(output, source, rect, outputSize.width, outputSize.height).getImageData(0, 0, outputSize.width, outputSize.height).data;
      let transparent = false;
      for (let index = 3; index < pixels.length; index += 4) { if (pixels[index] < 255) { transparent = true; break; } }
      const mime = transparent ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, mime, .94));
      if (!blob) throw new Error('Não foi possível gerar o recorte.');
      const asset = await online.assets.upload(blob, { fileName: `recorte-${outputSize.width}x${outputSize.height}.${transparent ? 'png' : 'jpg'}`, name: `${alt || 'Imagem'} · recorte`, alt, category: 'outro' });
      onApply(asset.url); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o recorte. Tente novamente.'); }
    finally { setBusy(false); }
  }

  return <Modal title="Editar corte da imagem" onClose={() => { if (!busy) onClose(); }} wide>
    <div className="crop-layout">
      <div className="crop-source-panel">
        <p className="crop-panel-label">Selecione a área da foto</p>
        <button type="button" className={`crop-ratio-toggle${aspectLocked ? ' active' : ''}`} aria-label="Manter proporção recomendada" aria-pressed={aspectLocked} aria-describedby="crop-ratio-help" disabled={busy || !source} onClick={toggleAspectRatio}>
          <span className="crop-ratio-check" aria-hidden="true">{aspectLocked && <Check size={14} strokeWidth={3} />}</span>
          Manter proporção recomendada · {width} × {height}
        </button>
        <p className="crop-ratio-help" id="crop-ratio-help">Desmarque a proporção para criar um recorte personalizado arrastando as bordas ou os cantos.</p>
        <div className="crop-stage" style={{ aspectRatio: `${sourceWidth}/${sourceHeight}`, maxWidth: source ? Math.min(640, 480 * sourceWidth / sourceHeight) : 640 }}
          onPointerDown={event => beginDrag(event, 'selection')} onPointerMove={event => continueDrag(event, 'selection')}
          onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
          {source && <>
            <img className="crop-source-image" src={src} alt="" draggable={false} />
            <div className="crop-selection" role="group" aria-label="Área de recorte" aria-describedby="crop-instructions" tabIndex={busy ? -1 : 0}
              style={{ left: `${rect.left / sourceWidth * 100}%`, top: `${rect.top / sourceHeight * 100}%`, width: `${rect.width / sourceWidth * 100}%`, height: `${rect.height / sourceHeight * 100}%` }}
              onKeyDown={event => onSelectionKey(event)}>
              <div className="crop-guides" aria-hidden="true" />
              {cropHandles.map(handle => <button key={handle} type="button" className={`crop-handle ${handle}`} data-crop-handle={handle}
                aria-label={handleLabels[handle]} title={handleLabels[handle]} disabled={busy}
                onKeyDown={event => onSelectionKey(event, handle)} />)}
            </div>
          </>}
          {!source && <span role="status">{error ? 'Prévia indisponível' : 'Carregando imagem…'}</span>}
        </div>
        <p className="muted" id="crop-instructions">Arraste a área para mover. Puxe os cantos ou as bordas para definir o recorte. Use as setas para ajustar; Shift + seta move mais rápido.</p>
      </div>
      <div className="crop-controls">
        <div className="crop-note"><Crop size={20} /><div><strong>{outputSize.width} × {outputSize.height} px{!aspectLocked ? ' · recorte personalizado' : ''}</strong><p>O recorte será salvo como uma nova imagem e aplicado ao e-mail. A foto original será preservada.</p></div></div>
        <div className="crop-result"><p className="crop-panel-label">Resultado no e-mail</p>
          <canvas ref={canvas} width={outputSize.width} height={outputSize.height} tabIndex={source && !busy ? 0 : -1} role="img" aria-label="Prévia final do recorte. Arraste para ajustar a posição." aria-describedby="crop-instructions"
            onPointerDown={event => beginDrag(event, 'preview')} onPointerMove={event => continueDrag(event, 'preview')}
            onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
            onKeyDown={event => {
              if (!source || busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault(); const step = event.shiftKey ? 10 : 2;
              if (overflowX > .01 && event.key === 'ArrowLeft') changeControl(zoom, Math.min(100, x + step), y);
              if (overflowX > .01 && event.key === 'ArrowRight') changeControl(zoom, Math.max(0, x - step), y);
              if (overflowY > .01 && event.key === 'ArrowUp') changeControl(zoom, x, Math.min(100, y + step));
              if (overflowY > .01 && event.key === 'ArrowDown') changeControl(zoom, x, Math.max(0, y - step));
            }} />
        </div>
        <fieldset disabled={busy || !source}>
          <label>Zoom · {Math.round(zoom * 100)}%<input aria-label="Zoom" type="range" min="1" max="8" step="0.01" value={zoom} onChange={event => changeControl(Number(event.target.value), x, y)} /></label>
          <label>Posição horizontal · {Math.round(x)}%<input aria-label="Posição horizontal" type="range" min="0" max="100" step="0.1" value={x} disabled={overflowX < .01} onChange={event => changeControl(zoom, Number(event.target.value), y)} /></label>
          <label>Posição vertical · {Math.round(y)}%<input aria-label="Posição vertical" type="range" min="0" max="100" step="0.1" value={y} disabled={overflowY < .01} onChange={event => changeControl(zoom, x, Number(event.target.value))} /></label>
          <button className="button" type="button" onClick={() => { const center = baseCropRect(sourceWidth, sourceHeight, width, height); applyRect(center); }}><RotateCcw size={14} /> Redefinir recorte</button>
        </fieldset>
      </div>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className="button primary" onClick={() => void save()} disabled={busy || !source}>{busy ? 'Salvando…' : 'Salvar recorte'}</button></div>
  </Modal>;
}
