# Demo guide — showing the project in the lab / viva (≈10 minutes)

## 0. Before the session (do this 15 minutes early)

```powershell
cd resourcehub
Copy-Item .env.example .env          # first time only
docker compose up -d --build
docker compose --profile demo up -d  # synthetic traffic so the graphs move
docker compose ps                    # everything should be "running" / "healthy"
```

Open these tabs in this order:

1. http://localhost:8080 — the app
2. http://localhost:3000/d/resourcehub-overview — Grafana, Application Overview (set the time range to **Last 15 minutes**, refresh **5s**)
3. http://localhost:3000/d/resourcehub-infra — Grafana, Infrastructure
4. http://localhost:9090/targets — Prometheus targets
5. http://localhost:9090/alerts — Prometheus alerts
6. Your GitHub repo → **Actions** tab (a green CI run)
7. Your Jira board (Scrum board + Backlog + a story that has GitHub comments)

> If the traffic container has been running for a while, the graphs will already have history. Leave it running.

---

## 1. Plan — Jira (1.5 min)

Board: https://aravpalod2.atlassian.net/jira/software/projects/ORMS/boards/3 (project **ResourceHub**, key **ORMS**)

- **Backlog tab**: 7 epics (ORMS-1 to ORMS-7) and 32 stories (ORMS-8 to ORMS-39), each with story points and acceptance criteria. That's 118 points in total.
- **Sprints**: Sprint 1 Foundation (27 pts), Sprint 2 Core workflows (33), Sprint 3 UX & Maintenance (36) are **completed**. **Sprint 4 DevOps & Monitoring (22) is active**.
- **Board tab** (active Sprint 4): 4 stories Done, *ORMS-38 Prometheus alert rules* In Progress, *ORMS-39 Jira <-> GitHub integration* To Do.
- **Reports**: Burndown chart, Velocity report, Sprint report.
- Open **ORMS-22** *"Reject overlapping bookings with 409 Conflict"* to show acceptance criteria that map straight to code and tests.
- **Live finish of ORMS-39**: push the branch `feature/ORMS-39-jira-github-integration` and open and merge a PR titled `ORMS-39 Jira GitHub integration`. GitHub Actions comments on the issue and moves it to **Done** while the examiner watches. The steps are also in the comment on ORMS-39.

## 2. Code & CI/CD — GitHub Actions (2 min)

- Open the latest **CI** run and walk through the 5 jobs: backend tests (24 tests against a throw-away MongoDB container) → frontend build → monitoring config validation (`promtool`) → Docker image build → **full-stack smoke test**.
- Open the *smoke-test* log: the whole `docker compose` stack boots on the GitHub runner, Prometheus reports the API target **UP**, and Grafana reports both dashboards provisioned.
- Open **CD**: images pushed to GHCR (`Packages` on the repo page).
- Optional live demo: make a small change on a branch `feature/ORMS-XX-...`, push it, open a PR and show the Jira issue update.

## 3. Run — Docker (1 min)

```powershell
docker compose ps
docker images | Select-String resourcehub      # small multi-stage images
```

- Explain the containers: frontend (nginx), backend, mongo, prometheus, grafana, node-exporter, cadvisor, mongodb-exporter, traffic.
- *"No Kubernetes. Self-healing comes from `restart: unless-stopped` + `HEALTHCHECK`, start-up order from `depends_on: service_healthy`, and service discovery from Docker DNS."*
- **Self-healing demo:** `docker kill rh-backend`, then run `docker compose ps` again a few seconds later. It comes back by itself because of the restart policy. On Grafana the **API status** stat flips to DOWN and back to UP, and the `ResourceHubApiDown` alert goes pending.

## 4. The application (2.5 min)

Log in as **admin** (`admin@resourcehub.com` / `Admin@123`):
- **Dashboard**: KPIs, bookings per day, resources by status/category, open tickets, recent activity.
- **Requests**: approve Sneha's laptop request. The asset becomes *Allocated*, and other pending requests for it close automatically.
- **Maintenance**: the CRITICAL battery ticket. Resolve it and show the laptop going back to *Available*.

Log in as **employee** (`employee@resourcehub.com` / `Employee@123`) in a private window:
- **Room Bookings**: click an empty slot and book it.
- Try to book an **overlapping** slot and you get a red toast: *"…is already booked…"* (HTTP 409).
- Book the **adjacent** slot (11:00–12:00 after 10:00–11:00). That one succeeds.
- Try to open `/users` and you are redirected away. The API would return **403**.

## 5. Monitor — Prometheus & Grafana (3 min)

**Prometheus** (http://localhost:9090):
- `/targets`: 6 jobs, all UP (resourcehub-api is scraped every 5 s).
- `/alerts`: **CriticalMaintenanceTicketOpen** is *firing* because of the demo data. This is a business alert, not just an infrastructure one.
- Run a query in *Graph*: `sum by (route) (rate(rh_http_requests_total[1m]))`

**Grafana → ResourceHub – Application Overview**:
- *Service health* row: API UP, MongoDB UP, req/s, 5xx rate, p95 latency.
- *Golden signals*: request rate by route, status codes (the 401/403/409 bars come from the traffic generator's failed logins, RBAC denials and booking conflicts), latency percentiles.
- *Business KPIs*: total/available/allocated resources, pending requests, bookings today, **asset utilisation gauge**, booking attempts by outcome (confirmed vs **conflict**), failed vs successful logins.
- Make a booking conflict in the app and watch the **conflict** bar increase within about 10 s.
- *Node.js runtime*: heap, CPU, event-loop lag, GC.

**Grafana → Infrastructure & Containers**: target table, host CPU/RAM/disk, **per-container CPU and memory** (cAdvisor), MongoDB ops/sec.

The in-app **Monitoring** page embeds the same Grafana dashboard and shows live API health.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Port already in use | Change `FRONTEND_PORT`, `GRAFANA_PORT`, etc. in `.env` |
| Grafana panels show "No data" right after start | Wait 30–60 s. Rates need two scrapes. Set the time range to *Last 15 minutes*. |
| Container panels (cAdvisor) are empty on Docker Desktop | Docker Desktop → Settings → General → untick **"Use containerd for pulling and storing images"**, apply and restart, then `docker compose up -d`. cAdvisor cannot read containers from the containerd image store yet. Everything else works either way. |
| MongoDB panels empty | `docker compose logs mongodb-exporter` |
| Want a clean slate | `docker compose down -v` then `docker compose up -d --build` (demo data is reseeded) |
| Embedded Grafana on the Monitoring page is blank | Open Grafana directly at http://localhost:3000. Some browsers block third-party iframes. |
