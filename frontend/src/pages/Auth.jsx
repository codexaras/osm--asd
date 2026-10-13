import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, CalendarClock, LineChart, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Shell({ children, title, subtitle }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">R</div>
          <span className="text-lg font-semibold">ResourceHub</span>
        </div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight">Every laptop, room and projector — tracked in one place.</h2>
          <ul className="mt-8 space-y-4 text-brand-100">
            <li className="flex items-center gap-3"><Boxes className="h-5 w-5" /> Asset catalogue, requests and allocations</li>
            <li className="flex items-center gap-3"><CalendarClock className="h-5 w-5" /> Conflict-free meeting room booking</li>
            <li className="flex items-center gap-3"><Wrench className="h-5 w-5" /> Maintenance tickets with full audit trail</li>
            <li className="flex items-center gap-3"><LineChart className="h-5 w-5" /> Live Prometheus + Grafana monitoring</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200">Agile Software Development & DevOps Lab · Docker · GitHub Actions · Jira</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = (email, password) => setForm({ email, password });

  return (
    <Shell title="Welcome back" subtitle="Sign in to manage office resources">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-4 text-sm">
        <p className="mb-2 font-medium text-slate-600">Demo accounts</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1 text-xs" onClick={() => demo('admin@resourcehub.com', 'Admin@123')}>
            Admin
          </button>
          <button className="btn-secondary flex-1 text-xs" onClick={() => demo('employee@resourcehub.com', 'Employee@123')}>
            Employee
          </button>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{' '}
        <Link className="font-medium text-brand-600 hover:underline" to="/signup">
          Create an employee account
        </Link>
      </p>
    </Shell>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', department: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Create your account" subtitle="Self-service sign-up creates an employee account">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="label">Full name</span>
          <input className="input" required value={form.name} onChange={set('name')} />
        </label>
        <label className="block">
          <span className="label">Work email</span>
          <input className="input" type="email" required value={form.email} onChange={set('email')} />
        </label>
        <label className="block">
          <span className="label">Department</span>
          <input className="input" value={form.department} onChange={set('department')} placeholder="e.g. Engineering" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="input" type="password" minLength={6} required value={form.password} onChange={set('password')} />
        </label>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link className="font-medium text-brand-600 hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
