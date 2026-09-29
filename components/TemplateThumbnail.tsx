'use client';
import { useEffect, useState } from 'react';
import { createCampaign } from '@/campaigns/model';
import { templateContent } from '@/templates/starter';
import { defaultBrand } from '@/data/brand';
import type { TemplateId } from '@/types/campaign';

export default function TemplateThumbnail({ template, label }: { template: TemplateId; label: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const campaign = createCampaign({ template, content: templateContent(template, label) });
    fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign, brand: defaultBrand, language: 'pt' }), signal: abort.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('Preview indisponível');
      return response.json();
    }).then((result) => setHtml(result.editorHtml)).catch(() => {});
    return () => abort.abort();
  }, [template, label]);
  return <div className="template-live-preview" aria-hidden="true">
    {html ? <iframe title={`Miniatura ${label}`} tabIndex={-1} sandbox="" srcDoc={html} scrolling="no" />
      : <div className="template-loading">{label}<small>Preparando layout…</small></div>}
  </div>;
}
