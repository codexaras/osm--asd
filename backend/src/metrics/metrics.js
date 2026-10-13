/**
 * Prometheus instrumentation for ResourceHub.
 *
 * Three groups of metrics are exposed on GET /api/metrics:
 *   1. Golden-signal HTTP metrics   (traffic, latency, errors, saturation)
 *   2. Business event counters      (logins, bookings, conflicts, requests ...)
 *   3. Business state gauges        (resources by status, pending requests ...)
 *      - computed from MongoDB at scrape time and cached for a few seconds
 * plus the default Node.js process metrics (CPU, heap, event-loop lag, GC).
 */
import client from 'prom-client';
import mongoose from 'mongoose';
import env from '../config/env.js';

export const register = new client.Registry();
register.setDefaultLabels({ app: 'resourcehub' });

client.collectDefaultMetrics({ register, prefix: 'rh_' });

const PKG_VERSION = process.env.npm_package_version || '1.0.0';

// ---------------------------------------------------------------------------
// 1. HTTP golden signals
// ---------------------------------------------------------------------------
const httpRequests = new client.Counter({
  name: 'rh_http_requests_total',
  help: 'Total HTTP requests handled by the API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpDuration = new client.Histogram({
  name: 'rh_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

const httpInFlight = new client.Gauge({
  name: 'rh_http_requests_in_flight',
  help: 'HTTP requests currently being processed',
  registers: [register]
});

new client.Gauge({
  name: 'rh_app_info',
  help: 'Static build information about the running API',
  labelNames: ['version', 'node_version', 'environment'],
  registers: [register]
}).set({ version: PKG_VERSION, node_version: process.version, environment: env.NODE_ENV }, 1);

new client.Gauge({
  name: 'rh_db_up',
  help: '1 if the API is connected to MongoDB, 0 otherwise',
  registers: [register],
  collect() {
    this.set(mongoose.connection.readyState === 1 ? 1 : 0);
  }
});

// Normalise the route label so IDs do not explode label cardinality.
const routeLabel = (req) => {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
  return 'unmatched';
};

export const metricsMiddleware = (req, res, next) => {
  if (req.path === '/api/metrics') return next();
  httpInFlight.inc();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeLabel(req), status_code: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
    httpInFlight.dec();
  });
  return next();
};

// ---------------------------------------------------------------------------
// 2. Business event counters (incremented from the service layer)
// ---------------------------------------------------------------------------
export const events = {
  logins: new client.Counter({
    name: 'rh_logins_total',
    help: 'Login attempts by result',
    labelNames: ['result'],
    registers: [register]
  }),
  signups: new client.Counter({
    name: 'rh_signups_total',
    help: 'Self-service employee sign-ups',
    registers: [register]
  }),
  requests: new client.Counter({
    name: 'rh_resource_requests_total',
    help: 'Resource request lifecycle events',
    labelNames: ['action'],
    registers: [register]
  }),
  allocations: new client.Counter({
    name: 'rh_allocations_total',
    help: 'Allocation lifecycle events',
    labelNames: ['action'],
    registers: [register]
  }),
  bookings: new client.Counter({
    name: 'rh_bookings_total',
    help: 'Booking attempts by outcome (confirmed, conflict, cancelled)',
    labelNames: ['outcome'],
    registers: [register]
  }),
  maintenance: new client.Counter({
    name: 'rh_maintenance_tickets_total',
    help: 'Maintenance tickets raised, by priority',
    labelNames: ['priority'],
    registers: [register]
  })
};

// Pre-initialise label sets so panels show 0 instead of "No data" on a fresh start.
['success', 'failure'].forEach((r) => events.logins.inc({ result: r }, 0));
['created', 'approved', 'rejected', 'cancelled'].forEach((a) => events.requests.inc({ action: a }, 0));
['allocated', 'return_requested', 'returned'].forEach((a) => events.allocations.inc({ action: a }, 0));
['confirmed', 'conflict', 'cancelled'].forEach((o) => events.bookings.inc({ outcome: o }, 0));
['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].forEach((p) => events.maintenance.inc({ priority: p }, 0));

// ---------------------------------------------------------------------------
// 3. Business state gauges (read from MongoDB, cached between scrapes)
// ---------------------------------------------------------------------------
let snapshot = null;
let snapshotAt = 0;
let inflight = null;

const groupCount = async (modelName, pipeline) => {
  const model = mongoose.models[modelName];
  if (!model) return [];
  return model.aggregate(pipeline);
};

const buildSnapshot = async () => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [resources, requests, allocations, upcoming, today, tickets, users] = await Promise.all([
    groupCount('Resource', [{ $group: { _id: { status: '$status', category: '$category' }, n: { $sum: 1 } } }]),
    groupCount('ResourceRequest', [{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    groupCount('Allocation', [{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    mongoose.models.Booking?.countDocuments({ status: 'CONFIRMED', startAt: { $gte: now } }) ?? 0,
    mongoose.models.Booking?.countDocuments({ status: 'CONFIRMED', startAt: { $gte: startOfDay, $lt: endOfDay } }) ?? 0,
    groupCount('Maintenance', [{ $group: { _id: { status: '$status', priority: '$priority' }, n: { $sum: 1 } } }]),
    groupCount('User', [{ $group: { _id: { role: '$role', active: '$isActive' }, n: { $sum: 1 } } }])
  ]);

  return { resources, requests, allocations, upcoming, today, tickets, users };
};

const getSnapshot = async () => {
  if (mongoose.connection.readyState !== 1) return null;
  if (snapshot && Date.now() - snapshotAt < env.BUSINESS_METRICS_TTL_MS) return snapshot;
  if (!inflight) {
    inflight = buildSnapshot()
      .then((s) => {
        snapshot = s;
        snapshotAt = Date.now();
        return s;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

const gauge = (name, help, labelNames, fill) =>
  new client.Gauge({
    name,
    help,
    labelNames,
    registers: [register],
    async collect() {
      try {
        const s = await getSnapshot();
        if (!s) return;
        this.reset();
        fill(this, s);
      } catch {
        // Never fail a scrape because of a business metric.
      }
    }
  });

gauge('rh_resources', 'Resources in the catalogue by status and category', ['status', 'category'], (g, s) => {
  s.resources.forEach((r) => g.set({ status: r._id.status, category: r._id.category }, r.n));
});

gauge('rh_resource_requests', 'Resource requests by current status', ['status'], (g, s) => {
  ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].forEach((st) => g.set({ status: st }, 0));
  s.requests.forEach((r) => g.set({ status: r._id }, r.n));
});

gauge('rh_allocations', 'Allocations by current status', ['status'], (g, s) => {
  ['ACTIVE', 'RETURN_REQUESTED', 'RETURNED'].forEach((st) => g.set({ status: st }, 0));
  s.allocations.forEach((r) => g.set({ status: r._id }, r.n));
});

gauge('rh_bookings_upcoming', 'Confirmed bookings starting in the future', [], (g, s) => g.set(s.upcoming));
gauge('rh_bookings_today', 'Confirmed bookings starting today', [], (g, s) => g.set(s.today));

gauge('rh_maintenance_tickets', 'Maintenance tickets by status and priority', ['status', 'priority'], (g, s) => {
  s.tickets.forEach((t) => g.set({ status: t._id.status, priority: t._id.priority }, t.n));
});

gauge('rh_users', 'Registered users by role and active flag', ['role', 'active'], (g, s) => {
  s.users.forEach((u) => g.set({ role: u._id.role, active: String(u._id.active) }, u.n));
});

gauge('rh_asset_utilization_ratio', 'Share of allocatable (non-shared, non-retired) assets currently allocated', [], (g, s) => {
  // Category based: shared categories are booked, not allocated.
  const shared = new Set(['Meeting Room', 'Projector']);
  let total = 0;
  let allocated = 0;
  s.resources.forEach((r) => {
    if (shared.has(r._id.category) || r._id.status === 'RETIRED') return;
    total += r.n;
    if (r._id.status === 'ALLOCATED') allocated += r.n;
  });
  g.set(total ? allocated / total : 0);
});

export const resetBusinessCache = () => {
  snapshot = null;
  snapshotAt = 0;
};
