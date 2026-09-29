'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { materials } from '@/data/materials';
import type { CampaignContent, StoneMaterial } from '@/types/campaign';
import { plainText } from '@/campaigns/model';

export default function MaterialSelector({
  content,
  selectedId,
  onApply,
}: {
  content: CampaignContent;
  selectedId?: string;
  onApply: (material: StoneMaterial, replace: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<StoneMaterial>();
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return materials.filter((material) =>
      `${material.name} ${material.category}`.toLowerCase().includes(normalized),
    );
  }, [query]);
  const hasEditedContent = Boolean(
    content.materialName ||
      content.features ||
      content.applications ||
      plainText(content.body).trim(),
  );

  function choose(material: StoneMaterial) {
    if (hasEditedContent) setPending(material);
    else {
      onApply(material, false);
      setQuery(material.name);
    }
  }

  return (
    <div className="material-selector">
      <label className="material-search">
        <span>Buscar material</span>
        <div>
          <Search size={15} />
          <input
            value={query}
            placeholder="Nome ou categoria…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </label>
      <div className="material-options" role="listbox" aria-label="Materiais disponíveis">
        {results.map((material) => (
          <button
            type="button"
            role="option"
            aria-selected={material.id === selectedId}
            className={material.id === selectedId ? 'active' : ''}
            key={material.id}
            onClick={() => choose(material)}
          >
            <strong>{material.name}</strong>
            <span>{material.category}</span>
          </button>
        ))}
        {!results.length && <p>Nenhum material encontrado.</p>}
      </div>
      {pending && (
        <div className="material-confirm" role="alert">
          <strong>Como aplicar {pending.name}?</strong>
          <p>Já existe conteúdo editado nesta campanha.</p>
          <div>
            <button
              type="button"
              className="button"
              onClick={() => {
                onApply(pending, false);
                setQuery(pending.name);
                setPending(undefined);
              }}
            >
              Preencher só campos vazios
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                onApply(pending, true);
                setQuery(pending.name);
                setPending(undefined);
              }}
            >
              Substituir conteúdo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
