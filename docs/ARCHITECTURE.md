# Architecture

## Backend layering
```
routes/index.js     URL → middleware (protect, authorize('ADMIN')) → controller
controllers/*.js    parse the HTTP request, call a service, shape the response (ok/created)
services/*.js       ALL business rules + metrics events + audit log + notifications
models/*.js         Mongoose schemas and indexes
middleware/         JWT auth, role guard, central error handler (validation → 400, cast → 400, dup key → 409)
metrics/metrics.js  Prometheus registry, HTTP middleware, business counters and gauges
```
Controllers never touch models directly, and services never touch `req`/`res`. This keeps the rules testable and reusable. For example, `allocate()` is shared by request approval and direct allocation.

## Data model
```
User ──< ResourceRequest >── Resource ──< Booking (shared resources only)
  │                              │
  └──< Allocation >──────────────┤
                                 └──< Maintenance (ticketNo, priority, previousResourceStatus)
User ──< Notification       User ──< ActivityLog (actor, action, entity, entityId, description)
```

## Resource state machine
```
            approve request / direct allocate (atomic)
AVAILABLE ───────────────────────────────────────────► ALLOCATED
    ▲   ◄────────── confirm return (GOOD) ──────────────── │
    │                                                      │ confirm return (DAMAGED)
    │ resolve ticket                                       ▼
UNDER_MAINTENANCE ◄────────── report issue ──────── (any non-retired)
    │
RETIRED (admin, only when nothing is allocated)
```
Shared resources (rooms, projectors) never become ALLOCATED. They are booked by time slot.

## Frontend
React Router with two guards: `RequireAuth` (logged in) and `RequireAuth adminOnly`. One set of role-aware pages, rather than duplicated admin and employee pages. `lib/api.js` wraps fetch, attaches the JWT and logs out on a 401. In Docker, nginx serves the build and proxies `/api`, so the browser only ever talks to one origin.

## Security
- bcrypt password hashes, never returned (`toJSON` strips them)
- JWT signed with `JWT_SECRET` from the environment
- Mass-assignment protection: services `pick()` allowed fields, and sign-up hard-codes `role: EMPLOYEE`
- Role checks on the server (the UI hiding things is only for convenience)
- Backend container runs as non-root, and the DB is only on `backend-net`
- GitHub workflows pass untrusted input via env vars, with least-privilege `permissions`
