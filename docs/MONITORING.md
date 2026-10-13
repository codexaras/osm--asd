# Monitoring — Prometheus & Grafana

## Data flow
```
backend /api/metrics ─┐
node-exporter :9100 ──┤
cadvisor :8080 ───────┼──► Prometheus :9090 ──► Grafana :3000 (dashboards)
mongodb-exporter :9216┤        │
grafana /metrics ─────┘        └─► alert.rules.yml ──► /alerts
```
Prometheus *pulls* metrics. The API is scraped every **5 s** and everything else every 15 s, with 15-day retention on the `prometheus-data` volume.

## Instrumentation (backend/src/metrics/metrics.js)
1. **HTTP middleware**: counts every request and times it into a histogram. The `route` label uses the Express route *pattern* (`/api/bookings/:id/cancel`), never the raw URL, so cardinality stays bounded. Unknown URLs are labelled `unmatched`.
2. **Event counters**: incremented in the service layer when something happens (login success/failure, booking confirmed/conflict/cancelled, request created/approved/rejected …). Label sets are pre-initialised to 0, so panels never show "No data".
3. **State gauges**: computed with MongoDB aggregations *at scrape time* through prom-client's `collect()` hook, cached for 5 s so frequent scrapes don't load the DB. They always reflect the real database, even after a restart.

## Useful PromQL
```promql
sum(rate(rh_http_requests_total[1m]))                                    # throughput
sum(rate(rh_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(rh_http_requests_total[5m]))   # error ratio
histogram_quantile(0.95, sum by (le) (rate(rh_http_request_duration_seconds_bucket[5m])))          # p95
sum by (outcome) (increase(rh_bookings_total[1h]))                       # bookings vs conflicts
rh_asset_utilization_ratio                                               # % of assets in use
sum by (category) (rh_resources{status="AVAILABLE"})                     # free stock per category
```

## Dashboards as code
`scripts/grafana/build_dashboards.py` generates `monitoring/grafana/dashboards/*.json`. Grafana loads them on start through `provisioning/dashboards/dashboards.yml`, and the datasource (uid `prometheus`) comes from `provisioning/datasources/prometheus.yml`. No clicking in the UI is needed. After changing panels:
```bash
python3 scripts/grafana/build_dashboards.py && docker compose restart grafana
```
UI edits are allowed but are lost when the JSON is regenerated. Export them back into the generator if you want to keep them.

## Alert rules
| Alert | Condition |
|---|---|
| ResourceHubApiDown | `up{job="resourcehub-api"} == 0` for 30 s |
| DatabaseDisconnected | `rh_db_up == 0` for 30 s |
| ExporterDown | node-exporter / cadvisor / mongodb target down 1 m |
| HighServerErrorRate | 5xx ratio > 5 % for 2 m |
| SlowApiResponses | p95 > 500 ms for 5 m |
| HighHeapUsage / EventLoopLag | Node.js runtime pressure |
| CriticalMaintenanceTicketOpen | any CRITICAL ticket not resolved (fires with demo data) |
| PendingRequestsBacklog / BookingConflictSpike / BruteForceLoginSuspected | business anomalies |
| HostHighCpu / HostLowMemory | node-exporter |

To deliver alerts by e-mail or Slack, add an Alertmanager container and an `alerting:` block in `prometheus.yml`. Alternatively, use Grafana Alerting with a contact point.

## Try it
- `docker kill rh-backend`: the **API status** stat goes red, the alert goes *pending*, and the container restarts by itself.
- Run `docker compose --profile demo up -d` and set `TRAFFIC_RPS=15` in `.env` to make the graphs busier.
