import { ArrowUpRight } from 'lucide-react';
import TemplateThumbnail from './TemplateThumbnail';
import { templates } from '@/templates/registry';
import type { TemplateId } from '@/types/campaign';
export default function TemplateLibrary({ onUse }: { onUse: (id: TemplateId) => void }) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">UMA MARCA. DIFERENTES CONVERSAS.</div>
          <h1>Templates</h1>
          <p>Estruturas prontas para o conteúdo da Granistone.</p>
        </div>
        <span className="collection-label">COLEÇÃO / 01—05</span>
      </div>
      <div className="template-grid">
        {templates.map((t, i) => (
          <button key={t.id} className="template-card" onClick={() => onUse(t.id)}>
            <div className={`template-mini mini-${t.id}`}>
              <TemplateThumbnail template={t.id} label={t.label} />
              <span className="template-index">0{i + 1}</span>
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
        ))}
      </div>
    </div>
  );
}
