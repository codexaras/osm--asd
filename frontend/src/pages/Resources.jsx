import { useState } from 'react';
import { CalendarPlus, Pencil, Plus, Search, Send, Settings2, Trash2, UserPlus, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, Spinner, Table, useApi } from '../components/ui';

const CATEGORIES = ['Laptop', 'Monitor', 'Projector', 'Meeting Room', 'Printer', 'Phone', 'Furniture', 'Other'];
const STATUSES = ['AVAILABLE', 'ALLOCATED', 'UNDER_MAINTENANCE', 'RETIRED'];
const blank = { assetTag: '', name: '', category: 'Laptop', location: '', description: '', isShared: false, capacity: 0 };

function ResourceForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Asset tag">
        <input className="input" value={value.assetTag} onChange={set('assetTag')} placeholder="LAP-010" />
      </Field>
      <Field label="Category">
        <select
          className="input"
          value={value.category}
          onChange={(e) =>
            onChange({ ...value, category: e.target.value, isShared: ['Meeting Room', 'Projector'].includes(e.target.value) })
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Name">
          <input className="input" value={value.name} onChange={set('name')} placeholder="Dell Latitude 7440" />
        </Field>
      </div>
      <Field label="Location">
        <input className="input" value={value.location} onChange={set('location')} placeholder="IT Store, Floor 2" />
      </Field>
      <Field label="Capacity (rooms)">
        <input className="input" type="number" min={0} value={value.capacity} onChange={set('capacity')} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <textarea className="input" rows={2} value={value.description} onChange={set('description')} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={value.isShared} onChange={set('isShared')} /> Shared resource (booked by time slot, not allocated)
      </label>
    </div>
  );
}

export default function Resources() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', category: '', status: '' });
  const { data, loading, error, reload } = useApi(() => api.resources(filters), [filters.category, filters.status, filters.search]);
  const users = useApi(() => (isAdmin ? api.users({ role: 'EMPLOYEE' }) : Promise.resolve([])), [isAdmin]);

  const [modal, setModal] = useState(null); // {type, resource}
  const [form, setForm] = useState(blank);
  const [extra, setExtra] = useState({});
  const [busy, setBusy] = useState(false);

  const open = (type, resource, init = {}) => {
    setModal({ type, resource });
    setForm(resource ? { ...blank, ...resource } : blank);
    setExtra(init);
  };
  const close = () => setModal(null);

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      close();
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const r = modal?.resource;
    switch (modal?.type) {
      case 'create':
        return run(() => api.createResource(form), 'Resource added');
      case 'edit':
        return run(() => api.updateResource(r._id, form), 'Resource updated');
      case 'request':
        return run(() => api.createRequest({ resourceId: r._id, reason: extra.reason, neededUntil: extra.neededUntil }), 'Request sent to admin');
      case 'allocate':
        return run(() => api.allocate({ resourceId: r._id, employeeId: extra.employeeId, dueDate: extra.dueDate }), 'Resource allocated');
      case 'report':
        return run(() => api.reportIssue({ resourceId: r._id, issue: extra.issue, priority: extra.priority }), 'Issue reported');
      case 'status':
        return run(() => api.setResourceStatus(r._id, extra.status), 'Status updated');
      default:
        return null;
    }
  };

  const remove = (r) => {
    if (window.confirm(`Delete ${r.assetTag} - ${r.name}?`)) run(() => api.deleteResource(r._id), 'Resource deleted');
  };

  const columns = [
    { label: 'Asset', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.name}</p>
        <p className="text-xs text-slate-500">{r.assetTag}</p>
      </div>
    ) },
    { label: 'Category', render: (r) => (
      <span>
        {r.category}
        {r.isShared && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">SHARED{r.capacity ? ` · ${r.capacity}` : ''}</span>}
      </span>
    ) },
    { label: 'Location', key: 'location' },
    { label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      label: '',
      className: 'text-right whitespace-nowrap',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {!isAdmin && !r.isShared && r.status === 'AVAILABLE' && (
            <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => open('request', r, { reason: '' })}>
              <Send className="h-3.5 w-3.5" /> Request
            </button>
          )}
          {r.isShared && r.status === 'AVAILABLE' && (
            <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => navigate(`/bookings?resource=${r._id}`)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Book
            </button>
          )}
          {isAdmin && !r.isShared && r.status === 'AVAILABLE' && (
            <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => open('allocate', r, { employeeId: '' })}>
              <UserPlus className="h-3.5 w-3.5" /> Allocate
            </button>
          )}
          {(isAdmin || r.isShared) && r.status !== 'UNDER_MAINTENANCE' && r.status !== 'RETIRED' && (
            <button className="btn-ghost p-1.5" title="Report issue" onClick={() => open('report', r, { issue: '', priority: 'MEDIUM' })}>
              <Wrench className="h-4 w-4" />
            </button>
          )}
          {isAdmin && (
            <>
              <button className="btn-ghost p-1.5" title="Change status" onClick={() => open('status', r, { status: r.status })}>
                <Settings2 className="h-4 w-4" />
              </button>
              <button className="btn-ghost p-1.5" title="Edit" onClick={() => open('edit', r)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button className="btn-ghost p-1.5 text-rose-600" title="Delete" onClick={() => remove(r)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const titles = { create: 'Add resource', edit: 'Edit resource', request: 'Request resource', allocate: 'Allocate resource', report: 'Report an issue', status: 'Change status' };

  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle={isAdmin ? 'Manage the company asset catalogue' : 'Browse assets to request, or rooms to book'}
        actions={
          isAdmin && (
            <button className="btn-primary" onClick={() => open('create')}>
              <Plus className="h-4 w-4" /> Add resource
            </button>
          )
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name, tag or location"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select className="input w-44" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input w-48" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="card overflow-hidden">
        {loading && !data ? <Spinner /> : <Table columns={columns} rows={data} empty={{ title: 'No resources match your filters' }} />}
      </div>

      <Modal
        open={!!modal}
        title={titles[modal?.type]}
        onClose={close}
        wide={modal?.type === 'create' || modal?.type === 'edit'}
        footer={
          <>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </>
        }
      >
        {(modal?.type === 'create' || modal?.type === 'edit') && <ResourceForm value={form} onChange={setForm} />}
        {modal?.type && !['create', 'edit'].includes(modal.type) && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium">{modal.resource.name}</span> · {modal.resource.assetTag}
          </p>
        )}
        {modal?.type === 'request' && (
          <>
            <Field label="Why do you need it?">
              <textarea className="input" rows={3} value={extra.reason} onChange={(e) => setExtra({ ...extra, reason: e.target.value })} />
            </Field>
            <Field label="Needed until (optional)">
              <input className="input" type="date" value={extra.neededUntil || ''} onChange={(e) => setExtra({ ...extra, neededUntil: e.target.value })} />
            </Field>
          </>
        )}
        {modal?.type === 'allocate' && (
          <>
            <Field label="Employee">
              <select className="input" value={extra.employeeId} onChange={(e) => setExtra({ ...extra, employeeId: e.target.value })}>
                <option value="">Select employee…</option>
                {(users.data || []).filter((u) => u.isActive).map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} — {u.department}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due back (optional)">
              <input className="input" type="date" value={extra.dueDate || ''} onChange={(e) => setExtra({ ...extra, dueDate: e.target.value })} />
            </Field>
          </>
        )}
        {modal?.type === 'status' && (
          <Field label="New status" hint="Allocated is set automatically by the allocation workflow">
            <select className="input" value={extra.status} onChange={(e) => setExtra({ ...extra, status: e.target.value })}>
              {STATUSES.filter((st) => st !== 'ALLOCATED').map((st) => (
                <option key={st} value={st}>
                  {st.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
        )}
        {modal?.type === 'report' && (
          <>
            <Field label="What's wrong?">
              <textarea className="input" rows={3} value={extra.issue} onChange={(e) => setExtra({ ...extra, issue: e.target.value })} />
            </Field>
            <Field label="Priority">
              <select className="input" value={extra.priority} onChange={(e) => setExtra({ ...extra, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
}
