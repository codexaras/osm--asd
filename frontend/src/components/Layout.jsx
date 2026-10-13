import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Boxes,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  PackageCheck,
  UserCircle,
  Users,
  Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/resources', label: 'Resources', icon: Boxes },
  { to: '/requests', label: 'Requests', icon: ClipboardList },
  { to: '/allocations', label: 'Allocations', icon: PackageCheck },
  { to: '/bookings', label: 'Room Bookings', icon: CalendarClock },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/users', label: 'Employees', icon: Users, admin: true },
  { to: '/activity', label: 'Audit Log', icon: Activity, admin: true },
  { to: '/monitoring', label: 'Monitoring', icon: LineChart },
  { to: '/profile', label: 'My Profile', icon: UserCircle }
];

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);

  const load = () => api.notifications().then(setData).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => {
      clearInterval(t);
      document.removeEventListener('mousedown', close);
    };
  }, []);

  const markAll = async () => {
    await api.readAll();
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative p-2" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {data.unread > 0 && (
              <button className="text-xs font-medium text-brand-600 hover:underline" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.items.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up</p>}
            {data.items.map((n) => (
              <div key={n._id} className={`border-b border-slate-50 px-4 py-3 text-sm ${n.isRead ? '' : 'bg-brand-50/50'}`}>
                <p className="text-slate-700">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {n.type} · {timeAgo(n.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((n) => !n.admin || isAdmin);

  const sidebar = (
    <nav className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">R</div>
        <div>
          <p className="text-sm font-semibold text-white">ResourceHub</p>
          <p className="text-[11px] text-slate-400">Office Resource Management</p>
        </div>
      </div>
      <div className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
        <button
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <aside className="absolute inset-y-0 left-0 w-64" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            Signed in as <span className="font-medium text-slate-800">{user?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                isAdmin ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
              }`}
            >
              {user?.role}
            </span>
            <Notifications />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
