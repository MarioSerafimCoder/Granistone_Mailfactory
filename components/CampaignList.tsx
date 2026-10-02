'use client';
import { useState } from 'react';
import { Search, ArrowUpRight, Plus, Upload, ArrowRight, Mail, Trash2 } from 'lucide-react';
import { campaignTypes, statuses, type Campaign } from '@/types/campaign';
import { languages, languageStates } from '@/campaigns/model';
import type { SyncMetadata } from '@/types/workspace';
import { editorName, relativeTime, activityTime } from '@/lib/workspace-display';
export function StatusBadge({ status }: { status: Campaign['status'] }) {
  return (
    <span className={`status status-${statuses.indexOf(status)}`}>
      <i />
      {status}
    </span>
  );
}
export default function CampaignList({
  campaigns,
  onOpen,
  onDelete,
  onCreate,
  onImport,
  activity,
  reviewIds,
}: {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  activity?: SyncMetadata['activity'];
  reviewIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [month, setMonth] = useState('');
  const [audience, setAudience] = useState('');
  const [language, setLanguage] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'date' | 'updated' | 'name' | 'status'>('date');
  const [quick, setQuick] = useState('');
  const [onlyReview, setOnlyReview] = useState(!!reviewIds?.length);
  const reviewSet = new Set(reviewIds);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const filtered = campaigns
    .filter(
      (c) =>
        (!search || `${c.title} ${c.audience}`.toLowerCase().includes(search.toLowerCase())) &&
        (!type || c.campaignType === type) &&
        (!month || c.date.startsWith(month)) &&
        (!audience || c.audience === audience) &&
        (!language || c.language.includes(language)) &&
        (!status || languages(c).some(lang => languageStates(c)[lang].status === status)) &&
        (!quick || (quick === 'month' ? c.date.startsWith(thisMonth) : quick === 'Aprovado' ? languages(c).every(lang => ['Aprovado', 'Exportado'].includes(languageStates(c)[lang].status)) : languages(c).some(lang => languageStates(c)[lang].status === quick))) &&
        (!onlyReview || reviewSet.has(c.id)),
    )
    .sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title, 'pt-BR')
      : sort === 'updated' ? (activity?.[b.id]?.updatedAt || b.updatedAt).localeCompare(activity?.[a.id]?.updatedAt || a.updatedAt)
      : sort === 'status' ? a.status.localeCompare(b.status, 'pt-BR')
      : (a.date || '9999').localeCompare(b.date || '9999'));
  const inProgress = campaigns.filter(
    (c) => languages(c).some(lang => ['Em produção', 'Revisão'].includes(languageStates(c)[lang].status)),
  ).length;
  const ready = campaigns.filter(c => languages(c).every(lang => ['Aprovado', 'Exportado'].includes(languageStates(c)[lang].status))).length;
  const emptyTitle = month
    ? `Nenhuma campanha em ${new Date(`${month}-15T12:00:00`).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })}`
    : campaigns.length
      ? 'Nenhuma campanha com esses filtros'
      : 'Seu próximo e-mail começa aqui';
  return (
    <div className="page campaign-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SEU ESPAÇO DE PRODUÇÃO</div>
          <h1>Campanhas</h1>
          <p>Do planejamento à próxima conversa.</p>
        </div>
        <div className="actions">
          <button className="button" onClick={onImport}>
            <Upload size={16} />
            Importar planejamento
          </button>
          <button className="button primary" onClick={onCreate}>
            <Plus size={17} />
            Nova campanha
          </button>
        </div>
      </div>
      <div className="overview">
        <div>
          <span>NO PLANEJAMENTO</span>
          <strong>{String(campaigns.length).padStart(2, '0')}</strong>
          <small>campanhas no studio</small>
        </div>
        <div>
          <span>EM MOVIMENTO</span>
          <strong>{String(inProgress).padStart(2, '0')}</strong>
          <small>em produção ou revisão</small>
        </div>
        <div>
          <span>PRONTAS PARA SEGUIR</span>
          <strong>
            {String(
              ready,
            ).padStart(2, '0')}
          </strong>
          <small>aprovadas ou exportadas</small>
        </div>
        <button onClick={onImport} className="planning-callout">
          <FileMark />
          <span>
            <strong>Seu mês começa na planilha.</strong>
            <small>Importe o planejamento e comece a criar.</small>
          </span>
          <ArrowUpRight size={20} />
        </button>
      </div>
      {campaigns.some((c) => c.demo) && (
        <div className="demo-note">
          EXEMPLOS{' '}
          <span>
            As campanhas identificadas como demonstração servem para explorar os templates.
          </span>
        </div>
      )}
      <div className="list-heading">
        <h2>
          Seu planejamento <span>{filtered.length}</span>
        </h2>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Buscar campanhas"
            value={search}
            placeholder="Buscar campanha…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="filters">
        <select aria-label="Ordenar campanhas" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="date">Data de disparo</option><option value="updated">Última alteração</option><option value="name">Nome</option><option value="status">Status</option>
        </select>
        <select aria-label="Filtrar mês" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Todos os meses</option>
          {[...new Set(campaigns.map((c) => c.date.slice(0, 7)).filter(Boolean))]
            .sort()
            .map((m) => (
              <option key={m} value={m}>
                {new Date(`${m}-15T12:00:00`).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
        </select>
        <select aria-label="Filtrar tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {campaignTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar público"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        >
          <option value="">Todos os públicos</option>
          {[...new Set(campaigns.map((c) => c.audience).filter(Boolean))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar idioma"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="">Todos os idiomas</option>
          <option>PT</option>
          <option>EN</option>
          <option>ES</option>
        </select>
        <select
          aria-label="Filtrar status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {statuses.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {(month || type || audience || language || status || search || quick || onlyReview) && (
          <button
            className="text-button"
            onClick={() => {
              setMonth('');
              setType('');
              setAudience('');
              setLanguage('');
              setStatus('');
              setSearch('');
              setQuick(''); setOnlyReview(false);
            }}
          >
            Limpar
          </button>
        )}
      </div>
      <div className="quick-filters" aria-label="Filtros rápidos">
        {([['Em produção', 'Em produção'], ['Revisão', 'Revisão'], ['Aprovadas', 'Aprovado'], ['Este mês', 'month']] as const).map(([label, value]) => <button key={value} className={quick === value ? 'active' : ''} aria-pressed={quick === value} onClick={() => setQuick(quick === value ? '' : value)}>{label}</button>)}
        {reviewIds?.length ? <button className={onlyReview ? 'active' : ''} aria-pressed={onlyReview} onClick={() => setOnlyReview(!onlyReview)}>Com pendências ({reviewIds.length})</button> : null}
      </div>
      {(month || type || audience || language || status || search || quick || onlyReview) && <p className="filter-feedback" role="status">{filtered.length} de {campaigns.length} campanhas com os filtros atuais.</p>}
      <div className="table-wrap">
        <table className="campaign-table">
          <thead>
            <tr>
              <th>DISPARO</th>
              <th>CAMPANHA</th>
              <th>TIPO</th>
              <th>PÚBLICO</th>
              <th>IDIOMA</th>
              <th>STATUS</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="date-cell">
                    <strong>{c.date ? c.date.slice(-2) : '—'}</strong>
                    <span>
                      {c.date
                        ? new Date(`${c.date}T12:00:00`)
                            .toLocaleDateString('pt-BR', { month: 'short' })
                            .replace('.', '')
                            .toUpperCase()
                        : 'SEM DATA'}
                    </span>
                  </div>
                </td>
                <td>
                  <button className="campaign-title" onClick={() => onOpen(c.id)}>
                    {c.title}
                  </button>
                  {c.demo && (
                    <div className="campaign-meta">
                      <span>Demonstração</span>
                    </div>
                  )}
                  {activity?.[c.id]?.updatedAt && <div className="campaign-activity" title={activityTime(activity[c.id].updatedAt)}>Atualizado {relativeTime(activity[c.id].updatedAt)} · {editorName(activity[c.id].updatedBy)}</div>}
                </td>
                <td>{c.campaignType}</td>
                <td>{c.audience || 'Público a definir'}</td>
                <td>
                  <span className="language-badge">{c.language}</span>
                </td>
                <td>
                  {languages(c).map(lang => <div key={lang}><small>{lang.toUpperCase()} </small><StatusBadge status={languageStates(c)[lang].status} /></div>)}
                </td>
                <td>
                  <div className="campaign-actions">
                    <button
                      className="icon-button"
                      aria-label={`Abrir ${c.title}`}
                      onClick={() => onOpen(c.id)}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                    <button
                      className="icon-button delete-campaign"
                      aria-label={`Excluir ${c.title}`}
                      title="Excluir e-mail"
                      onClick={() => onDelete(c.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="empty">
          <Mail size={30} />
          <h3>{emptyTitle}</h3>
          <p>Crie uma campanha ou importe seu planejamento mensal.</p>
          <div className="empty-actions">
            <button className="button" onClick={onImport}>
              <Upload size={15} /> Importar planilha
            </button>
            <button className="button primary" onClick={onCreate}>
              Nova campanha <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      <div className="list-footer">
        <span>
          {filtered.length} de {campaigns.length} campanhas
        </span>
        <span>Campanhas online compartilhadas · rascunhos locais identificados no editor.</span>
      </div>
    </div>
  );
}
function FileMark() {
  return (
    <div className="file-mark">
      <span />
      <span />
      <span />
    </div>
  );
}
