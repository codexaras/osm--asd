import { useState } from 'react';
import { api } from '../lib/api';
import { Badge, ErrorBox, PageHeader, Spinner, Table, useApi } from '../components/ui';
import { fmtDateTime } from '../lib/format';

const ENTITIES = ['', 'User', 'Resource', 'ResourceRequest', 'Allocation', 'Booking', 'Maintenance'];

export default function Activity() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => api.activity({ entity, page, limit: 25 }), [entity, page]);

  const columns = [
    { label: 'When', render: (a) => <span className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(a.createdAt)}</span> },
    { label: 'Actor', render: (a) => (
      <div>
        <p className="font-medium">{a.actor?.name || 'System'}</p>
        {a.actor?.role && <p className="text-xs text-slate-500">{a.actor.role}</p>}
      </div>
    ) },
    { label: 'Action', render: (a) => <span className="font-mono text-xs">{a.action}</span> },
    { label: 'Entity', render: (a) => <Badge tone="slate">{a.entity}</Badge> },
    { label: 'Details', key: 'description' }
  ];

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every state-changing action is recorded with who did it and when" />
      <div className="mb-4 flex items-center gap-3">
        <select className="input w-56" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e || 'All entities'}</option>
          ))}
        </select>
        {data && <span className="text-sm text-slate-500">{data.total} events</span>}
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="card overflow-hidden">
        {loading && !data ? <Spinner /> : <Table columns={columns} rows={data?.items} />}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm">
            <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {data.pages}</span>
            <button className="btn-secondary px-3 py-1" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
