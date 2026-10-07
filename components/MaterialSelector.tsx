'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { CampaignContent, StoneMaterial } from '@/types/campaign';
import { plainText } from '@/campaigns/model';
import { online } from '@/lib/online';
import type { MediaAsset } from '@/types/online';
import { materials as sampleMaterials } from '@/data/materials';
import { catalogMaterials } from '@/lib/catalog-materials';

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
  const [materials, setMaterials] = useState<StoneMaterial[]>(sampleMaterials);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    online.session().then((session) => session.editor ? Promise.all([online.materials.list(), online.assets.list()]) : null).then((response) => {
      if (!response) return;
      const [items, assets] = response;
      if (!active) return;
      const byId = new Map<string, MediaAsset>(assets.map((asset) => [asset.id, asset]));
      setMaterials(catalogMaterials(items.filter(item => item.active), assets).map(({ material: item }) => ({
        id: item.id, name: item.name, slug: item.slug, category: item.category,
        description: item.description, features: item.features, applications: item.applications,
        images: item.assetIds.map((id) => byId.get(id)?.url).filter(Boolean) as string[],
        heroImage: byId.get(item.heroAssetId || item.assetIds[0])?.url || '',
        slabImage: byId.get(item.slabAssetId || item.applicationAssetId || item.assetIds[1] || item.assetIds[0])?.url || '',
      })));
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Materiais indisponíveis.'); });
    return () => { active = false; };
  }, []);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return materials.filter((material) =>
      `${material.name} ${material.category}`.toLowerCase().includes(normalized),
    );
  }, [query, materials]);
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
            {material.heroImage ? <img src={material.heroImage} alt="" loading="lazy" /> : <span className="material-option-placeholder" aria-hidden="true" />}
            <span className="material-option-copy"><strong>{material.name}</strong><small>{material.category || 'Material Granistone'}</small></span>
          </button>
        ))}
        {!results.length && <p>Nenhum material encontrado. Tente outro nome ou categoria.</p>}
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
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
