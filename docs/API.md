# REST API

Base URL: `http://localhost:5000/api`, or `/api` through the frontend on :8080.
Authentication: `Authorization: Bearer <JWT>`, where the token comes from `/auth/login`.
Every response has the shape `{ success, message, data }`. Errors are `{ success:false, message, details? }`.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | public | `200 UP` / `503 DEGRADED` with DB state |
| GET | `/metrics` | public | Prometheus exposition format |
| POST | `/auth/signup` | public | always creates EMPLOYEE |
| POST | `/auth/login` | public | → `{ user, token }` |
| GET / PUT | `/auth/me` | any | profile; password change needs `currentPassword` |
| GET | `/dashboard` | any | admin or employee view, depending on role |
| GET | `/notifications` · PATCH `/notifications/read-all` · `/notifications/:id/read` | any | |
| GET | `/activity?entity=&page=&limit=` | ADMIN | audit log |
| GET / POST | `/users` | ADMIN | `?search=&role=` |
| PUT | `/users/:id` · PATCH `/users/:id/status` | ADMIN | cannot demote or deactivate yourself |
| GET | `/resources?search=&category=&status=&shared=` | any | |
| GET | `/resources/meta` · `/resources/:id` | any | |
| POST / PUT / DELETE | `/resources[/:id]` | ADMIN | delete blocked when allocated or booked |
| PATCH | `/resources/:id/status` | ADMIN | AVAILABLE / UNDER_MAINTENANCE / RETIRED |
| GET | `/requests?status=` | any | employees see their own |
| POST | `/requests` | EMPLOYEE | `{ resourceId, reason, neededUntil? }` |
| PATCH | `/requests/:id/approve` | ADMIN | `{ note?, dueDate? }`, allocates atomically |
| PATCH | `/requests/:id/reject` | ADMIN | `{ note }` required |
| PATCH | `/requests/:id/cancel` | owner | |
| GET / POST | `/allocations` | any / ADMIN | POST = direct allocation `{ resourceId, employeeId, dueDate? }` |
| PATCH | `/allocations/:id/return-request` | owner | |
| PATCH | `/allocations/:id/confirm-return` | ADMIN | `{ condition: GOOD\|DAMAGED, note? }` |
| GET | `/bookings?scope=all&from=&to=&upcoming=&status=` | any | `scope=all` gives the shared calendar |
| POST | `/bookings` | any | `{ resourceId, purpose, startAt, endAt, attendees? }`, returns **409** on overlap |
| PATCH | `/bookings/:id/cancel` | owner / ADMIN | |
| GET / POST | `/maintenance` | any | report: `{ resourceId, issue, priority }` |
| PATCH | `/maintenance/:id` | ADMIN | `{ status, priority?, resolutionNote? }` |

Status codes used: 200, 201, 400 (validation), 401 (no or invalid token), 403 (role), 404, 409 (conflict, duplicate or unavailable), 503 (DB down).

### Example
```bash
TOKEN=$(curl -s localhost:5000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"employee@resourcehub.com","password":"Employee@123"}' | jq -r .data.token)
curl -s localhost:5000/api/resources?shared=true -H "Authorization: Bearer $TOKEN" | jq '.data[].name'
```
