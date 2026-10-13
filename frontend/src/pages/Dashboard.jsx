import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Users,
  Wrench
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Empty, ErrorBox, PageHeader, Spinner, StatCard, useApi } from '../components/ui';
import { fmtDateTime, fmtTime, humanize, timeAgo } from '../lib/format';

const STATUS_COLORS = { AVAILABLE: '#10b981', ALLOCATED: '#0ea5e9', UNDER_MAINTENANCE: '#f59e0b', RETIRED: '#94a3b8' };

function Panel({ title, action, children }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function AdminDashboard({ data }) {
  const s = data.stats;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total resources" value={s.totalResources} icon={Boxes} hint={`${s.available} available now`} />
        <StatCard label="Pending requests" value={s.pendingRequests} icon={ClipboardList} tone="amber" />
        <StatCard label="Active allocations" value={s.activeAllocations} icon={PackageCheck} tone="blue" hint={`${s.returnRequests} awaiting return`} />
        <StatCard label="Open maintenance" value={s.openTickets} icon={Wrench} tone="red" hint={`${s.employees} active employees`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Bookings per day (last 7 / next 7 days)">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.bookingsPerDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} width={24} />
                <Tooltip />
                <Bar dataKey="count" name="Bookings" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Resources by status">
          <div className="flex h-56 items-center">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={data.resourcesByStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {data.resourcesByStatus.map((r) => (
                    <Cell key={r.status} fill={STATUS_COLORS[r.status] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, humanize(n)]} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 text-sm">
              {data.resourcesByStatus.map((r) => (
                <li key={r.status} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[r.status] }} />
                  {humanize(r.status)} <span className="font-semibold">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Resources by category">
          <ul className="space-y-2.5">
            {data.resourcesByCategory.map((c) => (
              <li key={c.category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="font-medium">{c.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(c.count / s.totalResources) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Upcoming bookings" action={<Link to="/bookings" className="text-xs font-medium text-brand-600">View all</Link>}>
          {data.upcomingBookings.length === 0 ? (
            <Empty title="No upcoming bookings" />
          ) : (
            <ul className="space-y-3">
              {data.upcomingBookings.map((b) => (
                <li key={b._id} className="flex items-start gap-3 text-sm">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-brand-500" />
                  <div>
                    <p className="font-medium">{b.purpose}</p>
                    <p className="text-xs text-slate-500">
                      {b.resource?.name} · {fmtDateTime(b.startAt)}–{fmtTime(b.endAt)} · {b.bookedBy?.name}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Open maintenance tickets" action={<Link to="/maintenance" className="text-xs font-medium text-brand-600">Manage</Link>}>
          {data.openTickets.length === 0 ? (
            <Empty title="All equipment healthy" />
          ) : (
            <ul className="space-y-3">
              {data.openTickets.map((t) => (
                <li key={t._id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{t.resource?.name}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{t.issue}</p>
                  </div>
                  <Badge status={t.priority} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent activity" action={<Link to="/activity" className="text-xs font-medium text-brand-600">Audit log</Link>}>
          <ul className="space-y-3">
            {data.recentActivity.map((a) => (
              <li key={a._id} className="text-sm">
                <p className="text-slate-700">{a.description}</p>
                <p className="text-xs text-slate-400">
                  {a.actor?.name || 'System'} · {timeAgo(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function EmployeeDashboard({ data }) {
  const s = data.stats;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assets with me" value={s.myAssets} icon={PackageCheck} />
        <StatCard label="Pending requests" value={s.pendingRequests} icon={ClipboardList} tone="amber" />
        <StatCard label="Upcoming bookings" value={s.upcomingBookings} icon={CalendarClock} tone="blue" />
        <StatCard label="Unread notifications" value={s.unreadNotifications} icon={Bell} tone="violet" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="My assets" action={<Link to="/allocations" className="text-xs font-medium text-brand-600">Manage</Link>}>
          {data.allocations.length === 0 ? (
            <Empty title="No assets allocated" hint="Browse Resources to request one" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.allocations.map((a) => (
                <li key={a._id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{a.resource?.name}</p>
                    <p className="text-xs text-slate-500">
                      {a.resource?.assetTag} · {a.resource?.category}
                    </p>
                  </div>
                  <Badge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="My upcoming bookings" action={<Link to="/bookings" className="text-xs font-medium text-brand-600">Book a room</Link>}>
          {data.upcomingBookings.length === 0 ? (
            <Empty title="No bookings" />
          ) : (
            <ul className="space-y-3">
              {data.upcomingBookings.map((b) => (
                <li key={b._id} className="text-sm">
                  <p className="font-medium">{b.purpose}</p>
                  <p className="text-xs text-slate-500">
                    {b.resource?.name} · {fmtDateTime(b.startAt)}–{fmtTime(b.endAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent requests" action={<Link to="/requests" className="text-xs font-medium text-brand-600">View all</Link>}>
          {data.recentRequests.length === 0 ? (
            <Empty title="No requests yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentRequests.map((r) => (
                <li key={r._id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{r.resource?.name}</span>
                  <Badge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="My open issues" action={<Link to="/maintenance" className="text-xs font-medium text-brand-600">Report issue</Link>}>
          {data.openTickets.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> No open issues
            </div>
          ) : (
            <ul className="space-y-2">
              {data.openTickets.map((t) => (
                <li key={t._id} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> {t.resource?.name} — <Badge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.dashboard(), []);
  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0]} 👋`}
        subtitle={isAdmin ? 'Organisation-wide overview of assets, bookings and maintenance' : 'Your assets, requests and bookings at a glance'}
        actions={
          isAdmin && (
            <Link to="/users" className="btn-secondary">
              <Users className="h-4 w-4" /> Employees
            </Link>
          )
        }
      />
      {loading && !data && <Spinner />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && (isAdmin ? <AdminDashboard data={data} /> : <EmployeeDashboard data={data} />)}
    </div>
  );
}
