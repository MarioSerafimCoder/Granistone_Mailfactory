import { ArrowUpRight } from 'lucide-react';
import TemplateThumbnail from './TemplateThumbnail';
import { templates } from '@/templates/registry';
import type { TemplateId } from '@/types/campaign';
import type { Blueprint } from '@/types/design';
import SavedDesignLibrary from './SavedDesignLibrary';
export default function TemplateLibrary({ onUse, onCustomUse }: { onUse: (id: TemplateId) => void; onCustomUse: (blueprint: Blueprint, title: string) => void }) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">UMA MARCA. DIFERENTES CONVERSAS.</div>
          <h1>Templates</h1>
          <p>Estruturas prontas para o conteúdo da Granistone.</p>
        </div>
        <span className="collection-label">COLEÇÃO / 01—{String(templates.length).padStart(2, '0')}</span>
      </div>
      {(['essential', 'new'] as const).map(category => <section className="template-group" key={category}>
        <h2 className="template-group-label">{category === 'essential' ? 'ESSENCIAIS' : 'NOVOS LAYOUTS'}</h2>
        <div className="template-grid">{templates.filter(t => t.visualCategory === category).map(t => (
          <button key={t.id} className="template-card" onClick={() => onUse(t.id)}>
            <div className={`template-mini mini-${t.id}`}>
              <TemplateThumbnail template={t.id} label={t.label} />
              <span className="template-index">{String(templates.indexOf(t) + 1).padStart(2, '0')}</span>
            </div>
            <div className="template-description">
              <span className="eyebrow">{t.label}</span>
              <h2>
                {t.name}
                <ArrowUpRight size={20} />
              </h2>
              <p>{t.description}</p>
              <span className="use-template">Usar template →</span>
            </div>
          </button>
        ))}</div>
      </section>)}
      <section className="custom-templates"><h2>Templates Granistone</h2><p>Modelos personalizados do workspace. Para criar um, abra uma campanha e escolha “Salvar como template”.</p><SavedDesignLibrary kind="template" onUse={design => { if (design.kind === 'template') onCustomUse(design.payload, design.name); }} /></section>
    </div>
  );
}
