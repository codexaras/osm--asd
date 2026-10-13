import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, Spinner, Table, Tabs, useApi } from '../components/ui';
import { fmtDateTime, fmtTime, toLocalInput } from '../lib/format';

const DAY_START = 8;
const DAY_END = 20;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function DayGrid({ day, rooms, bookings, me, onPick }) {
  const pct = (date) => {
    const d = new Date(date);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.min(Math.max(((h - DAY_START) / (DAY_END - DAY_START)) * 100, 0), 100);
  };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="ml-48 flex border-b border-slate-200 text-[11px] text-slate-400">
          {HOURS.map((h) => (
            <div key={h} className="flex-1 border-l border-slate-100 py-1 pl-1">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {rooms.map((room) => (
          <div key={room._id} className="flex items-stretch border-b border-slate-100">
            <div className="w-48 shrink-0 px-3 py-3">
              <p className="text-sm font-medium text-slate-800">{room.name}</p>
              <p className="text-xs text-slate-500">
                {room.category}
                {room.capacity ? ` · ${room.capacity} seats` : ''}
                {room.status !== 'AVAILABLE' && <span className="ml-1 text-amber-600">· {room.status.replace('_', ' ').toLowerCase()}</span>}
              </p>
            </div>
            <div className="relative flex flex-1">
              {HOURS.map((h) => (
                <button
                  key={h}
                  disabled={room.status !== 'AVAILABLE'}
                  title={`Book ${room.name} at ${h}:00`}
                  onClick={() => {
                    const s = new Date(day);
                    s.setHours(h, 0, 0, 0);
                    onPick(room, s);
                  }}
                  className="flex-1 border-l border-slate-100 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              ))}
              {bookings
                .filter((b) => b.resource?._id === room._id)
                .map((b) => {
                  const mine = b.bookedBy?._id === me;
                  return (
                    <div
                      key={b._id}
                      className={`pointer-events-none absolute inset-y-1.5 overflow-hidden rounded-md px-2 py-1 text-[11px] leading-tight text-white shadow-sm ${
                        mine ? 'bg-brand-600' : 'bg-slate-500'
                      }`}
                      style={{ left: `${pct(b.startAt)}%`, width: `${Math.max(pct(b.endAt) - pct(b.startAt), 2)}%` }}
                    >
                      <p className="truncate font-semibold">{b.purpose}</p>
                      <p className="truncate opacity-80">
                        {fmtTime(b.startAt)}–{fmtTime(b.endAt)} · {b.bookedBy?.name}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Bookings() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [day, setDay] = useState(startOfDay(new Date()));
  const [tab, setTab] = useState('calendar');
  const nextDay = new Date(day.getTime() + 864e5);

  const rooms = useApi(() => api.resources({ shared: 'true' }), []);
  const dayBookings = useApi(
    () => api.bookings({ scope: 'all', status: 'CONFIRMED', from: day.toISOString(), to: nextDay.toISOString() }),
    [day.getTime()]
  );
  const mine = useApi(() => api.bookings({ upcoming: tab === 'mine' ? 'true' : undefined }), [tab]);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const openForm = (room, start) => {
    const s = start || new Date(Math.ceil(Date.now() / 36e5) * 36e5);
    setForm({
      resourceId: room?._id || params.get('resource') || '',
      purpose: '',
      attendees: 2,
      startAt: toLocalInput(s),
      endAt: toLocalInput(new Date(s.getTime() + 36e5))
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.createBooking({ ...form, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString() });
      toast.success('Booking confirmed');
      setForm(null);
      dayBookings.reload();
      mine.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (b) => {
    if (!window.confirm(`Cancel "${b.purpose}"?`)) return;
    try {
      await api.cancelBooking(b._id);
      toast.success('Booking cancelled');
      dayBookings.reload();
      mine.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const roomList = useMemo(() => rooms.data || [], [rooms.data]);

  const columns = [
    { label: 'Purpose', render: (b) => <span className="font-medium">{b.purpose}</span> },
    { label: 'Resource', render: (b) => b.resource?.name },
    ...(isAdmin ? [{ label: 'Booked by', render: (b) => b.bookedBy?.name }] : []),
    { label: 'When', render: (b) => `${fmtDateTime(b.startAt)} – ${fmtTime(b.endAt)}` },
    { label: 'Status', render: (b) => <Badge status={b.status} /> },
    {
      label: '',
      className: 'text-right',
      render: (b) =>
        b.status === 'CONFIRMED' &&
        new Date(b.endAt) > new Date() && (
          <button className="btn-ghost px-2 py-1 text-xs text-rose-600" onClick={() => cancel(b)}>
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </button>
        )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Room & equipment booking"
        subtitle="Click an empty slot to book. Overlapping bookings are rejected automatically."
        actions={
          <button className="btn-primary" onClick={() => openForm()}>
            <CalendarPlus className="h-4 w-4" /> New booking
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'calendar', label: 'Day view' },
            { value: 'mine', label: isAdmin ? 'All upcoming' : 'My upcoming' },
            { value: 'history', label: isAdmin ? 'All bookings' : 'My history' }
          ]}
        />
        {tab === 'calendar' && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary p-2" onClick={() => setDay(new Date(day.getTime() - 864e5))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              className="input w-40"
              value={toLocalInput(day).slice(0, 10)}
              onChange={(e) => e.target.value && setDay(startOfDay(new Date(`${e.target.value}T00:00`)))}
            />
            <button className="btn-secondary p-2" onClick={() => setDay(new Date(day.getTime() + 864e5))} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="btn-ghost text-xs" onClick={() => setDay(startOfDay(new Date()))}>
              Today
            </button>
          </div>
        )}
      </div>

      {tab === 'calendar' ? (
        <div className="card overflow-hidden">
          {rooms.error && <ErrorBox error={rooms.error} />}
          {rooms.loading && !rooms.data ? (
            <Spinner />
          ) : (
            <DayGrid day={day} rooms={roomList} bookings={dayBookings.data || []} me={user?._id} onPick={openForm} />
          )}
          <div className="flex gap-4 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand-600" /> Your booking</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-slate-500" /> Booked by others</span>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {mine.loading && !mine.data ? <Spinner /> : <Table columns={columns} rows={mine.data} empty={{ title: 'No bookings' }} />}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="New booking"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !form?.resourceId || !form?.purpose} onClick={submit}>
              {busy ? 'Booking…' : 'Confirm booking'}
            </button>
          </>
        }
      >
        {form && (
          <>
            <Field label="Room / equipment">
              <select className="input" value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })}>
                <option value="">Select…</option>
                {roomList.filter((r) => r.status === 'AVAILABLE').map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} {r.capacity ? `(${r.capacity} seats)` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Purpose">
              <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Sprint planning" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start">
                <input className="input" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </Field>
              <Field label="End">
                <input className="input" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </Field>
            </div>
            <Field label="Attendees">
              <input className="input" type="number" min={1} value={form.attendees} onChange={(e) => setForm({ ...form, attendees: Number(e.target.value) })} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
}
