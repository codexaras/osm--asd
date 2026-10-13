import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, Spinner, Table, Tabs, useApi } from '../components/ui';
import { fmtDate, timeAgo } from '../lib/format';

export default function Requests() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState(isAdmin ? 'PENDING' : '');
  const { data, loading, error, reload } = useApi(() => api.requests(), []);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = (data || []).filter((r) => !tab || r.status === tab);
  const count = (s) => (data || []).filter((r) => r.status === s).length;

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      setModal(null);
      setNote('');
      setDueDate('');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    ...(isAdmin
      ? [{ label: 'Employee', render: (r) => (
          <div>
            <p className="font-medium">{r.employee?.name}</p>
            <p className="text-xs text-slate-500">{r.employee?.department}</p>
          </div>
        ) }]
      : []),
    { label: 'Resource', render: (r) => (
      <div>
        <p className="font-medium">{r.resource?.name}</p>
        <p className="text-xs text-slate-500">{r.resource?.assetTag}</p>
      </div>
    ) },
    { label: 'Reason', render: (r) => <span className="line-clamp-2 max-w-xs">{r.reason}</span> },
    { label: 'Needed until', render: (r) => fmtDate(r.neededUntil) },
    { label: 'Submitted', render: (r) => timeAgo(r.createdAt) },
    { label: 'Status', render: (r) => (
      <div>
        <Badge status={r.status} />
        {r.reviewNote && <p className="mt-1 max-w-[180px] text-xs text-slate-500">{r.reviewNote}</p>}
      </div>
    ) },
    {
      label: '',
      className: 'text-right whitespace-nowrap',
      render: (r) =>
        r.status === 'PENDING' &&
        (isAdmin ? (
          <div className="flex justify-end gap-1">
            <button className="btn-primary px-2.5 py-1.5 text-xs" onClick={() => setModal({ type: 'approve', r })}>
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setModal({ type: 'reject', r })}>
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        ) : (
          <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => act(() => api.cancelRequest(r._id), 'Request cancelled')}>
            Cancel
          </button>
        ))
    }
  ];

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Resource requests' : 'My requests'}
        subtitle={isAdmin ? 'Review and approve employee asset requests' : 'Track the status of assets you have asked for'}
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'PENDING', label: 'Pending', count: count('PENDING') },
            { value: 'APPROVED', label: 'Approved', count: count('APPROVED') },
            { value: 'REJECTED', label: 'Rejected', count: count('REJECTED') },
            { value: '', label: 'All', count: data?.length }
          ]}
        />
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="card overflow-hidden">
        {loading && !data ? <Spinner /> : <Table columns={columns} rows={rows} empty={{ title: 'No requests in this view' }} />}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.type === 'approve' ? 'Approve request' : 'Reject request'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            {modal?.type === 'approve' ? (
              <button className="btn-primary" disabled={busy} onClick={() => act(() => api.approveRequest(modal.r._id, { note, dueDate: dueDate || undefined }), 'Approved and allocated')}>
                Approve & allocate
              </button>
            ) : (
              <button className="btn-danger" disabled={busy || !note} onClick={() => act(() => api.rejectRequest(modal.r._id, { note }), 'Request rejected')}>
                Reject
              </button>
            )}
          </>
        }
      >
        {modal && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium">{modal.r.employee?.name}</span> requested <span className="font-medium">{modal.r.resource?.name}</span>
          </p>
        )}
        {modal?.type === 'approve' && (
          <Field label="Due back (optional)">
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        )}
        <Field label={modal?.type === 'approve' ? 'Note (optional)' : 'Reason for rejection'}>
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
