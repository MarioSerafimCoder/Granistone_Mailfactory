'use client';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Search, Plus, ArrowUpRight, Mail, Trash2, Copy, MoreHorizontal } from 'lucide-react';
import { campaignTypes, statuses, type Campaign } from '@/types/campaign';
import { languages, languageStates } from '@/campaigns/model';
import type { SyncMetadata } from '@/types/workspace';
import { editorName, relativeTime, activityTime } from '@/lib/workspace-display';
import { ResourcePresence } from './WorkspacePresence';

export function StatusBadge({ status }: { status: Campaign['status'] }) {
  return <span className={`status status-${statuses.indexOf(status)}`}><i />{status}</span>;
}

type Stage = '' | Campaign['status'] | 'Aprovadas' | 'Pendências';

export default function CampaignList({ campaigns, onOpen, onDelete, onDuplicate, onCreate, activity, reviewIds, pendingIds, canEdit = true, canDelete = true }: {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onCreate: () => void;
  activity?: SyncMetadata['activity'];
  reviewIds?: string[];
  pendingIds?: string[];
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [month, setMonth] = useState('');
  const [audience, setAudience] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState<'date' | 'updated' | 'name' | 'status'>('date');
  const [stage, setStage] = useState<Stage>(reviewIds?.length ? 'Pendências' : '');
  const reviewSet = new Set(reviewIds);
  const pendingSet = new Set(pendingIds);
  const hasFilters = Boolean(search || type || month || audience || language || stage);
  const matchesStage = (campaign: Campaign, selected: Stage) => {
    if (!selected) return true;
    if (selected === 'Pendências') return reviewSet.has(campaign.id);
    const states = languages(campaign).map(lang => languageStates(campaign)[lang].status);
    if (selected === 'Aprovadas') return states.every(value => value === 'Aprovado' || value === 'Exportado');
    return states.some(value => value === selected);
  };
  const stages: { label: string; value: Stage }[] = [
    { label: 'Todas', value: '' }, { label: 'Pendentes', value: 'Pendente' },
    { label: 'Em produção', value: 'Em produção' }, { label: 'Revisão', value: 'Revisão' },
    { label: 'Aprovadas', value: 'Aprovadas' }, { label: 'Exportadas', value: 'Exportado' },
    ...(reviewIds?.length ? [{ label: 'Com pendências', value: 'Pendências' as Stage }] : []),
  ];
  const filtered = campaigns
    .filter(c => (!search || `${c.title} ${c.audience}`.toLowerCase().includes(search.trim().toLowerCase()))
      && (!type || c.campaignType === type)
      && (!month || c.date.startsWith(month))
      && (!audience || c.audience === audience)
      && (!language || c.language.includes(language))
      && matchesStage(c, stage))
    .sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title, 'pt-BR')
      : sort === 'updated' ? (activity?.[b.id]?.updatedAt || b.updatedAt).localeCompare(activity?.[a.id]?.updatedAt || a.updatedAt)
      : sort === 'status' ? a.status.localeCompare(b.status, 'pt-BR')
      : (a.date || '9999').localeCompare(b.date || '9999'));
  const recent = [...campaigns].sort((a, b) => (activity?.[b.id]?.updatedAt || b.updatedAt).localeCompare(activity?.[a.id]?.updatedAt || a.updatedAt))[0];
  function clearFilters() { setSearch(''); setType(''); setMonth(''); setAudience(''); setLanguage(''); setStage(''); }
  function openFromRow(event: MouseEvent<HTMLTableRowElement>, id: string) {
    if (!(event.target as Element).closest('button, a, summary, input, select')) onOpen(id);
  }
  function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); onOpen(id);
  }
  const emptyTitle = !campaigns.length ? 'Seu próximo e-mail começa aqui'
    : month ? `Nenhuma campanha em ${new Date(`${month}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
    : stage ? `Nenhuma campanha em ${stages.find(item => item.value === stage)?.label.toLowerCase()}`
    : 'Nenhuma campanha encontrada';

  return <div className="page campaign-page">
    <div className="page-heading">
      <div className="campaign-heading-copy">
        <h1>Campanhas</h1>
        <p>{campaigns.length} {campaigns.length === 1 ? 'campanha' : 'campanhas'} no workspace</p>
        {recent && <button className="campaign-resume" onClick={() => onOpen(recent.id)} aria-label={`Retomar ${recent.title}`}>
          <span>Retomar:</span> <strong>{recent.title}</strong> <ArrowUpRight size={14} />
          {pendingSet.has(recent.id) && <small>Alterações locais pendentes</small>}
        </button>}
      </div>
      <button className="button primary campaign-new" disabled={!canEdit} onClick={onCreate}><Plus size={17} />Nova campanha</button>
    </div>

    <div className="campaign-stage-tabs" role="group" aria-label="Filtrar por etapa de produção">
      {stages.map(item => {
        const count = item.value ? campaigns.filter(c => matchesStage(c, item.value)).length : campaigns.length;
        return <button key={item.value} type="button" className={count === 0 ? 'empty-stage' : ''} aria-pressed={stage === item.value} onClick={() => setStage(item.value)}>
          {item.label}<span>{count}</span>
        </button>;
      })}
    </div>

    <div className="campaign-toolbar">
      <label className="search"><Search size={17} /><input aria-label="Buscar campanhas" value={search} placeholder="Buscar campanhas…" onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Filtrar mês" value={month} onChange={event => setMonth(event.target.value)}>
        <option value="">Todos os meses</option>
        {[...new Set(campaigns.map(c => c.date.slice(0, 7)).filter(Boolean))].sort().map(value => <option key={value} value={value}>{new Date(`${value}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>)}
      </select>
      <select aria-label="Ordenar campanhas" value={sort} onChange={event => setSort(event.target.value as typeof sort)}>
        <option value="date">Data de disparo</option><option value="updated">Última alteração</option><option value="name">Nome</option><option value="status">Status</option>
      </select>
      <details className="advanced-filters"><summary>Filtros{type || audience || language ? ' · ativos' : ''}</summary><div className="filters">
        <select aria-label="Filtrar tipo" value={type} onChange={event => setType(event.target.value)}><option value="">Todos os tipos</option>{campaignTypes.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar público" value={audience} onChange={event => setAudience(event.target.value)}><option value="">Todos os públicos</option>{[...new Set(campaigns.map(c => c.audience).filter(Boolean))].map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar idioma" value={language} onChange={event => setLanguage(event.target.value)}><option value="">Todos os idiomas</option><option>PT</option><option>EN</option><option>ES</option></select>
      </div></details>
      {hasFilters && <button className="text-button clear-filters" onClick={clearFilters}>Limpar filtros</button>}
    </div>

    <div className="campaign-results" role="status">{hasFilters ? `${filtered.length} de ${campaigns.length} campanhas` : `${campaigns.length} ${campaigns.length === 1 ? 'campanha' : 'campanhas'}`}</div>
    <div className="table-wrap">
      <table className="campaign-table">
        <thead><tr><th>Campanha</th><th>Disparo</th><th>Idiomas e status</th><th><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>{filtered.map(c => <tr key={c.id} className="campaign-row" tabIndex={0} aria-label={`Abrir campanha ${c.title}`} onClick={event => openFromRow(event, c.id)} onKeyDown={event => openFromKeyboard(event, c.id)}>
          <td className="campaign-main-cell">
            <button className="campaign-title" onClick={() => onOpen(c.id)}>{c.title}</button>
            <ResourcePresence type="campaign" id={c.id} />
            <div className="campaign-meta">{c.campaignType} <span>·</span> {c.audience || 'Público a definir'}{c.demo && <span className="campaign-demo">Demonstração</span>}</div>
            <div className="campaign-activity" title={activityTime(activity?.[c.id]?.updatedAt || c.updatedAt)}>Atualizada {relativeTime(activity?.[c.id]?.updatedAt || c.updatedAt)}{activity?.[c.id]?.updatedBy ? ` · ${editorName(activity[c.id].updatedBy)}` : ''}</div>
            {pendingSet.has(c.id) && <span className="campaign-pending">Alterações locais pendentes</span>}
          </td>
          <td className="campaign-date-cell">{c.date ? <><strong>{c.date.slice(-2)}</strong><span>{new Date(`${c.date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}</span></> : <span>Sem data</span>}</td>
          <td className="campaign-languages">{languages(c).map(lang => <div key={lang}><span className="campaign-language-code">{lang.toUpperCase()}</span><StatusBadge status={languageStates(c)[lang].status} /></div>)}</td>
          <td className="campaign-actions-cell" onClick={event => event.stopPropagation()}>
            <details className="campaign-menu"><summary aria-label={`Ações de ${c.title}`} title="Ações da campanha"><MoreHorizontal size={19} /></summary><div className="campaign-menu-options">
              <button onClick={() => onOpen(c.id)}><ArrowUpRight size={16} />Abrir campanha</button>
              {canEdit && onDuplicate && <button onClick={() => onDuplicate(c.id)}><Copy size={16} />Duplicar</button>}
              {canDelete && <button className="danger" onClick={() => onDelete(c.id)}><Trash2 size={16} />Excluir</button>}
            </div></details>
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    {!filtered.length && <div className="empty campaign-empty"><Mail size={28} /><h3>{emptyTitle}</h3><p>{campaigns.length ? 'Ajuste a busca ou limpe os filtros para ver outras campanhas.' : 'Crie uma campanha ou importe seu planejamento mensal.'}</p>{!campaigns.length && <button className="button primary" disabled={!canEdit} onClick={onCreate}>Nova campanha</button>}</div>}
    {campaigns.some(c => c.demo) && <p className="campaign-demo-note">Campanhas de demonstração ajudam a explorar os templates.</p>}
  </div>;
}
