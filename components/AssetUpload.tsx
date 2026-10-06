'use client';
import { useRef, useState } from 'react';
import { FolderUp, Upload } from 'lucide-react';
import { prepareImage } from '@/lib/images';
import { folderForFile } from '@/lib/asset-folders';
import { online } from '@/lib/online';
import type { OnlineMaterial } from '@/types/online';

export default function AssetUpload({ folder, material, onComplete }: { folder: string; material?: OnlineMaterial; onComplete: () => Promise<void> }) {
  const filesInput = useRef<HTMLInputElement>(null); const folderInput = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false); const inFlight = useRef(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string }>();
  const [message, setMessage] = useState(''); const [errors, setErrors] = useState<string[]>([]);
  async function upload(files: FileList | null) {
    if (!files?.length || inFlight.current) return;
    inFlight.current = true; cancelled.current = false; setErrors([]); setMessage('');
    const batch = Array.from(files); const failures: string[] = []; const assetIds = new Set(material?.assetIds ?? []);
    let done = 0; let successful = 0;
    try {
      for (const file of batch) {
        if (cancelled.current) break;
        const name = file.webkitRelativePath || file.name;
        setProgress({ done, total: batch.length, name });
        try {
          if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use JPG, PNG ou WebP.');
          const uri = await prepareImage(file);
          const blob = await (await fetch(uri)).blob();
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const folderPaths = folderForFile(file, folder);
          const asset = await online.assets.upload(blob, {
            fileName: `imagem.${ext}`, name: file.name.replace(/\.[^.]+$/, ''),
            alt: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '), folderPaths,
            category: folderPaths.some(path => /institucion/i.test(path)) ? 'institucional' : 'outro',
          });
          assetIds.add(asset.id); successful++;
        } catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : 'Falha no envio.'}`); }
        done++;
      }
      if (material && successful) {
        // Read the current association so importing does not overwrite another editor's additions.
        const current = await online.materials.get(material.id);
        await online.materials.save({ ...current, assetIds: [...new Set([...current.assetIds, ...assetIds])] });
      }
      setMessage(`${successful} de ${batch.length} arquivos importados${cancelled.current ? ' · envio interrompido' : ''}. Imagens repetidas são reutilizadas.`);
    } catch (error) { failures.push(error instanceof Error ? error.message : 'Não foi possível associar as imagens ao material.'); }
    finally {
      setErrors(failures); setProgress(undefined); inFlight.current = false;
      if (filesInput.current) filesInput.current.value = '';
      if (folderInput.current) folderInput.current.value = '';
      await onComplete();
    }
  }
  return <div className="asset-upload">
    <div className="asset-upload-actions">
      <button className="button" type="button" disabled={!!progress} onClick={() => folderInput.current?.click()}><FolderUp size={16} /> Importar pasta</button>
      <button className="button primary" type="button" disabled={!!progress} onClick={() => filesInput.current?.click()}><Upload size={15} /> Enviar imagens</button>
    </div>
    <input ref={filesInput} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Enviar imagens para a biblioteca" onChange={event => void upload(event.target.files)} />
    <input ref={folderInput} className="sr-only" type="file" multiple webkitdirectory="" aria-label="Importar pasta de imagens" onChange={event => void upload(event.target.files)} />
    {progress && <div className="asset-upload-progress" role="status"><strong>Importando {progress.done + 1} de {progress.total}</strong><span>{progress.name}</span><progress max={progress.total} value={progress.done} /><span>Mantenha a biblioteca aberta até o envio terminar.</span><button type="button" className="button" onClick={() => { cancelled.current = true; }}>Interromper envio</button></div>}
    {message && <p className="asset-upload-result" role="status">{message}</p>}
    {!!errors.length && <details className="alert" open><summary>{errors.length} {errors.length === 1 ? 'arquivo ou associação precisa' : 'arquivos ou associações precisam'} de atenção</summary><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></details>}
  </div>;
}
