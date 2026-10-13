import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Field, PageHeader } from '../components/ui';
import { fmtDate } from '../lib/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, department: user.department, phone: user.phone || '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const save = async (payload, msg, reset) => {
    setBusy(true);
    try {
      const { user: updated } = await api.updateProfile(payload);
      setUser(updated);
      toast.success(msg);
      reset?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" subtitle={`Member since ${fmtDate(user.createdAt)}`} />
      <div className="card mb-6 p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
            {user.name?.[0]}
          </div>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <div className="ml-auto"><Badge status={user.role} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Department"><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <button className="btn-primary mt-4" disabled={busy} onClick={() => save(form, 'Profile saved')}>Save changes</button>
      </div>
      <div className="card p-6">
        <h3 className="mb-4 font-semibold">Change password</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password"><input className="input" type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} /></Field>
          <Field label="New password"><input className="input" type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} /></Field>
        </div>
        <button
          className="btn-secondary mt-4"
          disabled={busy || !pwd.newPassword}
          onClick={() => save(pwd, 'Password changed', () => setPwd({ currentPassword: '', newPassword: '' }))}
        >
          Update password
        </button>
      </div>
    </div>
  );
}
