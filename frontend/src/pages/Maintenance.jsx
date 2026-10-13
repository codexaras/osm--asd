import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, Spinner, Table, Tabs, useApi } from '../components/ui';
import { fmtDate, timeAgo } from '../lib/format';

export default function Maintenance() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('ACTIVE');
  const { data, loading, error, reload } = useApi(() => api.tickets(), []);
  // Resources an employee may report: shared ones + own allocations
  const reportable = useApi(async () => {
    if (isAdmin) return api.resources();
    const [shared, mine] = await Promise.all([api.resources({ shared: 'true' }), api.allocations({ status: 'ACTIVE' })]);
    return [...mine.map((a) => a.resource), ...shared];
  }, [isAdmin]);

  const [report, setReport] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = (data || []).filter((t) => (tab === 'ACTIVE' ? t.status !== 'RESOLVED' : tab === 'ALL' || t.status === tab));
  const n = (f) => (data || []).filter(f).length;

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      setReport(null);
      setEdit(null);
      reload();
      reportable.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { label: 'Ticket', render: (t) => <span className="font-mono text-xs">{t.ticketNo}</span> },
    { label: 'Resource', render: (t) => (
      <div>
        <p className="font-medium">{t.resource?.name}</p>
        <p className="text-xs text-slate-500">{t.resource?.assetTag}</p>
      </div>
    ) },
    { label: 'Issue', render: (t) => (
      <div className="max-w-xs">
        <p className="line-clamp-2">{t.issue}</p>
        {t.resolutionNote && <p className="mt-1 text-xs text-emerald-700">✔ {t.resolutionNote}</p>}
      </div>
    ) },
    { label: 'Priority', render: (t) => <Badge status={t.priority} /> },
    { label: 'Reported', render: (t) => (
      <div>
        <p>{t.reportedBy?.name}</p>
        <p className="text-xs text-slate-500">{timeAgo(t.createdAt)}</p>
      </div>
    ) },
    { label: 'Status', render: (t) => (
      <div>
        <Badge status={t.status} />
        {t.resolvedAt && <p className="mt-1 text-xs text-slate-500">{fmtDate(t.resolvedAt)}</p>}
      </div>
    ) },
    ...(isAdmin
      ? [{
          label: '',
          className: 'text-right',
          render: (t) =>
            t.status !== 'RESOLVED' && (
              <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setEdit({ t, status: t.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED', priority: t.priority, resolutionNote: '' })}>
                Update
              </button>
            )
        }]
      : [])
  ];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Reporting an issue takes the asset out of service until it is resolved"
        actions={
          <button className="btn-primary" onClick={() => setReport({ resourceId: '', issue: '', priority: 'MEDIUM' })}>
            <Plus className="h-4 w-4" /> Report issue
          </button>
        }
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ACTIVE', label: 'Active', count: n((t) => t.status !== 'RESOLVED') },
            { value: 'RESOLVED', label: 'Resolved', count: n((t) => t.status === 'RESOLVED') },
            { value: 'ALL', label: 'All', count: data?.length }
          ]}
        />
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="card overflow-hidden">
        {loading && !data ? <Spinner /> : <Table columns={columns} rows={rows} empty={{ title: 'No tickets in this view' }} />}
      </div>

      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title="Report an issue"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReport(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !report?.resourceId || !report?.issue} onClick={() => run(() => api.reportIssue(report), 'Ticket raised')}>
              Submit
            </button>
          </>
        }
      >
        {report && (
          <>
            <Field label="Resource" hint={isAdmin ? undefined : 'You can report shared rooms/equipment and assets allocated to you'}>
              <select className="input" value={report.resourceId} onChange={(e) => setReport({ ...report, resourceId: e.target.value })}>
                <option value="">Select…</option>
                {(reportable.data || [])
                  .filter((r) => r && r.status !== 'UNDER_MAINTENANCE' && r.status !== 'RETIRED')
                  .map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.assetTag} — {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Describe the problem">
              <textarea className="input" rows={3} value={report.issue} onChange={(e) => setReport({ ...report, issue: e.target.value })} />
            </Field>
            <Field label="Priority">
              <select className="input" value={report.priority} onChange={(e) => setReport({ ...report, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </>
        )}
      </Modal>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={`Update ${edit?.t.ticketNo || ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => api.updateTicket(edit.t._id, { status: edit.status, priority: edit.priority, resolutionNote: edit.resolutionNote }), 'Ticket updated')}
            >
              Save
            </button>
          </>
        }
      >
        {edit && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className="input" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Resolution / progress note">
              <textarea className="input" rows={3} value={edit.resolutionNote} onChange={(e) => setEdit({ ...edit, resolutionNote: e.target.value })} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
}
