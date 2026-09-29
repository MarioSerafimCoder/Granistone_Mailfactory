'use client';
import { useEffect, useState } from 'react';
import { createCampaign } from '@/campaigns/model';
import { templateContent } from '@/templates/starter';
import { defaultBrand } from '@/data/brand';
import type { TemplateId } from '@/types/campaign';
import { renderEmail } from '@/export/render';

export default function TemplateThumbnail({ template, label }: { template: TemplateId; label: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let cancelled = false;
    const campaign = createCampaign({ template, content: templateContent(template, label) });
    renderEmail(campaign, 'pt', defaultBrand, true)
      .then((editorHtml) => {
        if (!cancelled) setHtml(editorHtml);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [template, label]);
  return <div className="template-live-preview" aria-hidden="true">
    {html ? <iframe title={`Miniatura ${label}`} tabIndex={-1} sandbox="" srcDoc={html} scrolling="no" />
      : <div className="template-loading">{label}<small>Preparando layout…</small></div>}
  </div>;
}
