import { useState } from 'react';
import { Undo2, ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, Spinner, Table, Tabs, useApi } from '../components/ui';
import { fmtDate } from '../lib/format';

export default function Allocations() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('OPEN');
  const { data, loading, error, reload } = useApi(() => api.allocations(), []);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ note: '', condition: 'GOOD' });
  const [busy, setBusy] = useState(false);

  const rows = (data || []).filter((a) => (tab === 'OPEN' ? a.status !== 'RETURNED' : tab === 'ALL' ? true : a.status === tab));
  const n = (f) => (data || []).filter(f).length;

  const submit = async () => {
    setBusy(true);
    try {
      if (modal.type === 'return') await api.requestReturn(modal.a._id, { note: form.note });
      else await api.confirmReturn(modal.a._id, form);
      toast.success(modal.type === 'return' ? 'Return requested — hand the asset to IT' : 'Return confirmed');
      setModal(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const overdue = (a) => a.dueDate && a.status !== 'RETURNED' && new Date(a.dueDate) < new Date();

  const columns = [
    { label: 'Asset', render: (a) => (
      <div>
        <p className="font-medium">{a.resource?.name}</p>
        <p className="text-xs text-slate-500">
          {a.resource?.assetTag} · {a.resource?.category}
        </p>
      </div>
    ) },
    ...(isAdmin ? [{ label: 'Employee', render: (a) => (
      <div>
        <p className="font-medium">{a.employee?.name}</p>
        <p className="text-xs text-slate-500">{a.employee?.department}</p>
      </div>
    ) }] : []),
    { label: 'Allocated', render: (a) => fmtDate(a.createdAt) },
    { label: 'Due', render: (a) => <span className={overdue(a) ? 'font-semibold text-rose-600' : ''}>{fmtDate(a.dueDate)}{overdue(a) && ' (overdue)'}</span> },
    { label: 'Status', render: (a) => (
      <div className="space-y-1">
        <Badge status={a.status} />
        {a.returnCondition && <p className="text-xs text-slate-500">Condition: {a.returnCondition}</p>}
      </div>
    ) },
    {
      label: '',
      className: 'text-right whitespace-nowrap',
      render: (a) => (
        <>
          {!isAdmin && a.status === 'ACTIVE' && (
            <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => { setForm({ note: '', condition: 'GOOD' }); setModal({ type: 'return', a }); }}>
              <Undo2 className="h-3.5 w-3.5" /> Return
            </button>
          )}
          {isAdmin && a.status !== 'RETURNED' && (
            <button className="btn-primary px-2.5 py-1.5 text-xs" onClick={() => { setForm({ note: '', condition: 'GOOD' }); setModal({ type: 'confirm', a }); }}>
              <ClipboardCheck className="h-3.5 w-3.5" /> Check in
            </button>
          )}
        </>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Allocations' : 'My assets'}
        subtitle={isAdmin ? 'Who has what — and inspect assets on return' : 'Assets currently assigned to you'}
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'OPEN', label: 'Current', count: n((a) => a.status !== 'RETURNED') },
            { value: 'RETURN_REQUESTED', label: 'Awaiting return', count: n((a) => a.status === 'RETURN_REQUESTED') },
            { value: 'RETURNED', label: 'Returned', count: n((a) => a.status === 'RETURNED') },
            { value: 'ALL', label: 'All', count: data?.length }
          ]}
        />
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="card overflow-hidden">
        {loading && !data ? <Spinner /> : <Table columns={columns} rows={rows} empty={{ title: 'No allocations in this view' }} />}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.type === 'return' ? 'Return asset' : 'Check in returned asset'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={submit}>Confirm</button>
          </>
        }
      >
        {modal && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium">{modal.a.resource?.name}</span> · {modal.a.resource?.assetTag}
          </p>
        )}
        {modal?.type === 'confirm' && (
          <Field label="Condition on inspection" hint="Damaged assets automatically get a HIGH priority maintenance ticket">
            <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
              <option value="GOOD">Good — back to available stock</option>
              <option value="DAMAGED">Damaged — send to maintenance</option>
            </select>
          </Field>
        )}
        <Field label="Notes (optional)">
          <textarea className="input" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
}
