#!/usr/bin/env node
/**
 * Synthetic user traffic so the Grafana dashboards are alive during a demo.
 * Zero dependencies (uses Node 18+ global fetch).
 *
 *   node scripts/traffic-generator.js                      # against http://localhost:5000/api
 *   API_URL=http://backend:5000/api RPS=6 node traffic-generator.js
 *   docker compose --profile demo up -d                    # runs it as a container
 *
 * Mix of realistic actions: browsing, bookings (incl. deliberate overlaps -> 409),
 * requests + approvals/rejections, maintenance tickets, failed logins (401),
 * forbidden admin calls (403) and the odd unknown route (404).
 */
const API = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const RPS = Math.max(Number(process.env.RPS) || 4, 0.5);
const DURATION = Number(process.env.DURATION_SECONDS) || 0; // 0 = forever

const ADMIN = { email: 'admin@resourcehub.com', password: 'Admin@123' };
const EMPLOYEES = ['employee', 'priya', 'karan', 'sneha', 'vikram', 'ananya'].map((u) => ({
  email: `${u}@resourcehub.com`,
  password: 'Employee@123'
}));

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokens = new Map();
const stats = { ok: 0, clientErr: 0, serverErr: 0, netErr: 0 };

async function call(method, path, { token, body } = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status >= 500) stats.serverErr += 1;
    else if (res.status >= 400) stats.clientErr += 1;
    else stats.ok += 1;
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json.data };
  } catch {
    stats.netErr += 1;
    return { status: 0 };
  }
}

async function login(user) {
  if (tokens.has(user.email)) return tokens.get(user.email);
  const r = await call('POST', '/auth/login', { body: user });
  if (r.data?.token) tokens.set(user.email, r.data.token);
  return r.data?.token;
}

const futureSlot = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1 + Math.floor(Math.random() * 5));
  start.setHours(9 + Math.floor(Math.random() * 9), Math.random() < 0.5 ? 0 : 30, 0, 0);
  const end = new Date(start.getTime() + (1 + Math.floor(Math.random() * 2)) * 30 * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
};

// ---- scenarios (weighted) -------------------------------------------------
const scenarios = [
  [30, async function browse() {
    const t = await login(pick(EMPLOYEES));
    await call('GET', pick(['/dashboard', '/resources', '/bookings?upcoming=true', '/requests', '/allocations', '/notifications', '/auth/me']), { token: t });
  }],
  [12, async function adminBrowse() {
    const t = await login(ADMIN);
    await call('GET', pick(['/dashboard', '/users', '/activity', '/maintenance', '/requests?status=PENDING', '/resources?category=Laptop']), { token: t });
  }],
  [14, async function bookRoom() {
    const t = await login(pick(EMPLOYEES));
    const rooms = (await call('GET', '/resources?shared=true', { token: t })).data || [];
    const room = pick(rooms.filter((r) => r.status === 'AVAILABLE'));
    if (!room) return;
    const r = await call('POST', '/bookings', { token: t, body: { resourceId: room._id, purpose: pick(['Stand-up', '1:1', 'Client call', 'Design review', 'Interview']), attendees: 2, ...futureSlot() } });
    // Keep the calendar from filling up: cancel most successful bookings again shortly after
    if (r.status === 201 && Math.random() < 0.8) setTimeout(() => call('PATCH', `/bookings/${r.data._id}/cancel`, { token: t }), 20000);
  }],
  [6, async function doubleBook() {
    // Two people race for the same slot -> exactly one 201 and one 409 (conflict)
    const [a, b] = [await login(EMPLOYEES[0]), await login(EMPLOYEES[1])];
    const rooms = (await call('GET', '/resources?shared=true', { token: a })).data || [];
    const room = pick(rooms.filter((r) => r.status === 'AVAILABLE'));
    if (!room) return;
    const slot = futureSlot();
    const first = await call('POST', '/bookings', { token: a, body: { resourceId: room._id, purpose: 'Race A', ...slot } });
    await call('POST', '/bookings', { token: b, body: { resourceId: room._id, purpose: 'Race B', ...slot } });
    if (first.status === 201) setTimeout(() => call('PATCH', `/bookings/${first.data._id}/cancel`, { token: a }), 15000);
  }],
  [5, async function requestAndReview() {
    const empUser = pick(EMPLOYEES);
    const t = await login(empUser);
    const assets = ((await call('GET', '/resources?status=AVAILABLE&shared=false', { token: t })).data || []);
    const asset = pick(assets);
    if (!asset) return;
    const req = await call('POST', '/requests', { token: t, body: { resourceId: asset._id, reason: 'Needed for project work (traffic generator)' } });
    if (req.status !== 201) return;
    await sleep(1500);
    const admin = await login(ADMIN);
    if (Math.random() < 0.4) {
      const ok = await call('PATCH', `/requests/${req.data._id}/approve`, { token: admin, body: { note: 'Approved' } });
      // Return it again after a while so stock doesn't run out
      if (ok.status === 200) {
        const allocId = ok.data.allocation._id;
        setTimeout(async () => {
          await call('PATCH', `/allocations/${allocId}/return-request`, { token: t, body: { note: 'Done' } });
          await call('PATCH', `/allocations/${allocId}/confirm-return`, { token: admin, body: { condition: 'GOOD' } });
        }, 12000);
      }
    } else {
      await call('PATCH', `/requests/${req.data._id}/reject`, { token: admin, body: { note: 'Not in budget this quarter' } });
    }
  }],
  [2, async function maintenanceCycle() {
    const admin = await login(ADMIN);
    const rooms = ((await call('GET', '/resources?shared=true&status=AVAILABLE', { token: admin })).data || []);
    const room = pick(rooms);
    if (!room) return;
    const t = await call('POST', '/maintenance', { token: admin, body: { resourceId: room._id, issue: 'HDMI port loose', priority: pick(['LOW', 'MEDIUM', 'HIGH']) } });
    if (t.status === 201) {
      setTimeout(async () => {
        await call('PATCH', `/maintenance/${t.data._id}`, { token: admin, body: { status: 'IN_PROGRESS' } });
        await call('PATCH', `/maintenance/${t.data._id}`, { token: admin, body: { status: 'RESOLVED', resolutionNote: 'Cable replaced' } });
      }, 12000);
    }
  }],
  [5, async function badLogin() {
    await call('POST', '/auth/login', { body: { email: pick(EMPLOYEES).email, password: 'wrong-password' } });
  }],
  [4, async function forbidden() {
    const t = await login(pick(EMPLOYEES));
    await call('GET', pick(['/users', '/activity']), { token: t });
  }],
  [3, async function anonymous() {
    await call('GET', pick(['/dashboard', '/resources', '/no-such-endpoint']));
  }],
  [5, async function health() {
    await call('GET', '/health');
  }]
];
const totalWeight = scenarios.reduce((a, [w]) => a + w, 0);
const choose = () => {
  let n = Math.random() * totalWeight;
  for (const [w, fn] of scenarios) {
    if ((n -= w) <= 0) return fn;
  }
  return scenarios[0][1];
};

async function waitForApi() {
  for (let i = 0; i < 60; i += 1) {
    const r = await call('GET', '/health');
    if (r.status === 200) return;
    console.log(`[traffic] waiting for API at ${API} …`);
    await sleep(2000);
  }
  throw new Error('API never became healthy');
}

(async () => {
  await waitForApi();
  console.log(`[traffic] generating ~${RPS} scenarios/sec against ${API}${DURATION ? ` for ${DURATION}s` : ''}`);
  const started = Date.now();
  setInterval(() => console.log(`[traffic] 2xx/3xx=${stats.ok} 4xx=${stats.clientErr} 5xx=${stats.serverErr} network=${stats.netErr}`), 15000).unref();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (DURATION && Date.now() - started > DURATION * 1000) break;
    choose()().catch(() => {});
    await sleep((1000 / RPS) * (0.5 + Math.random()));
  }
  await sleep(1000);
  console.log('[traffic] done', stats);
  process.exit(0);
})();
