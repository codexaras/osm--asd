import { useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, Spinner, Table, useApi } from '../components/ui';
import { fmtDate, timeAgo } from '../lib/format';

const blank = { name: '', email: '', password: '', role: 'EMPLOYEE', department: '', phone: '' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useApi(() => api.users({ search }), [search]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (form._id) await api.updateUser(form._id, form);
      else await api.createUser(form);
      toast.success(form._id ? 'User updated' : 'User created');
      setForm(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u) => {
    try {
      await api.setUserStatus(u._id, !u.isActive);
      toast.success(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const columns = [
    { label: 'Name', render: (u) => (
      <div>
        <p className="font-medium">{u.name}</p>
        <p className="text-xs text-slate-500">{u.email}</p>
      </div>
    ) },
    { label: 'Department', key: 'department' },
    { label: 'Role', render: (u) => <Badge status={u.role} /> },
    { label: 'Assets held', render: (u) => u.activeAllocations },
    { label: 'Last login', render: (u) => (u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never') },
    { label: 'Joined', render: (u) => fmtDate(u.createdAt) },
    { label: 'Status', render: (u) => <Badge tone={u.isActive ? 'green' : 'slate'}>{u.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      label: '',
      className: 'text-right whitespace-nowrap',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost p-1.5" onClick={() => setForm({ ...blank, ...u })} title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          {u._id !== me._id && (
            <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => toggle(u)}>
              {u.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Admins are created here; public sign-up only creates employees"
        actions={
          <button className="btn-primary" onClick={() => setForm(blank)}>
            <Plus className="h-4 w-4" /> Add user
          </button>
        }
      />
      <div className="card mb-4 p-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search name, email, department" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="card overflow-hidden">{loading && !data ? <Spinner /> : <Table columns={columns} rows={data} />}</div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?._id ? 'Edit user' : 'Add user'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={save}>Save</button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={form.name} onChange={set('name')} /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')} disabled={!!form._id} /></Field>
            {!form._id && <Field label="Temporary password"><input className="input" type="password" value={form.password} onChange={set('password')} /></Field>}
            <Field label="Role">
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <Field label="Department"><input className="input" value={form.department} onChange={set('department')} /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
