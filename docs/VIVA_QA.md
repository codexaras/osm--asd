# Viva — likely questions & answers

**1. Why no Kubernetes? Don't you lose self-healing and scaling?**
The brief excluded Kubernetes, and for a single-host lab deployment Docker Compose covers what we need. `restart: unless-stopped` together with a Docker `HEALTHCHECK` gives self-healing, `depends_on: condition: service_healthy` gives ordered start-up (like readiness probes), Compose DNS gives service discovery, and nginx acts as the ingress. Compose can scale stateless services with `docker compose up --scale`. What we give up is multi-node scheduling and autoscaling, which this project doesn't need.

**2. How does Prometheus find the backend without Kubernetes service discovery?**
Static targets that use Compose service names (`backend:5000`). All monitoring containers share the `monitoring-net` network, and Docker's embedded DNS resolves the names.

**3. Pull vs push monitoring?**
Prometheus pulls `/api/metrics` every 5 s. The app stays simple, Prometheus knows immediately when a target is down (`up == 0`), and scraping adds no latency to user requests.

**4. What are the golden signals and where are they on the dashboard?**
Latency (p50/p95/p99 panel), Traffic (request rate by route), Errors (status-code and 4xx/5xx panels, 5xx-rate stat) and Saturation (in-flight requests, heap, event-loop lag, CPU).

**5. Why is the `route` label `/api/bookings/:id/cancel` and not the real URL?**
Every distinct label value creates a new time series. Raw URLs contain IDs, so the series count would grow without bound (high cardinality). Unknown URLs collapse into `unmatched`.

**6. Counter vs gauge vs histogram?**
A counter only goes up (total logins), and you look at its `rate()` or `increase()`. A gauge goes up and down (pending requests right now). A histogram counts observations into buckets (request latency), and `histogram_quantile()` estimates percentiles from it.

**7. How do business metrics like "available laptops" reach Prometheus?**
They are gauges with an async `collect()` that runs a MongoDB aggregation at scrape time, cached for 5 s. They are always consistent with the database, even after an API restart.

**8. Explain the booking-overlap rule.**
Intervals [s1,e1) and [s2,e2) overlap iff `s1 < e2 && s2 < e1`. It runs as one MongoDB query: `startAt < newEnd AND endAt > newStart AND status = CONFIRMED`. Because the intervals are half-open, back-to-back meetings are allowed. A conflict returns 409 and increments `rh_bookings_total{outcome="conflict"}`.

**9. How do you stop two admins allocating the same laptop at the same moment?**
`findOneAndUpdate({_id, status:'AVAILABLE'}, {status:'ALLOCATED'})` is atomic in MongoDB. Only one caller gets the document back, and the other gets 409. There is a test for it.

**10. Why an ephemeral MongoDB in CI rather than a cloud database?**
Each run is isolated and reproducible, there are no secrets or IP allow-lists, test data never pollutes real data, and it is fast.

**11. What does the smoke-test job prove that unit tests don't?**
That the containers work together: nginx proxies to the API, the API reaches Mongo, Prometheus scrapes the API (target UP, metrics ingested), and Grafana's datasource and provisioned dashboards load.

**12. Multi-stage Docker builds — why?**
The frontend builder stage carries Node and all of `node_modules`, but the final image is nginx plus static files (~50 MB instead of ~1 GB). The backend installs only production dependencies and runs as the non-root `node` user.

**13. How is Jira connected to the code?**
Issue keys go in branch names, commits and PR titles. `jira.yml` calls the Jira REST API to comment, transitions the issue (In Review on PR open, Done on merge) and creates a Bug when CI fails on `main`. The backlog itself is version-controlled in `jira/backlog.json` and created by a script.

**14. Velocity?**
118 points over 4 sprints, about 29.5 points per sprint (27 / 33 / 36 / 22). Show Jira's velocity chart.

**15. How are secrets handled?**
`.env` is git-ignored, and `.env.example` documents the variables. GitHub secrets hold the Jira token, and CD uses the built-in `GITHUB_TOKEN` for GHCR. Passwords are bcrypt-hashed, the JWT secret comes from the environment, and public sign-up can't escalate its role.

**16. What happens if MongoDB goes down?**
`/api/health` returns 503 DEGRADED, the Docker healthcheck marks the backend unhealthy, `rh_db_up` becomes 0, and the `DatabaseDisconnected` alert fires after 30 s. The API retries the connection on start-up.
