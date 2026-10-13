# CI/CD with GitHub Actions

```
push / PR ──► CI ─┬─ backend   (npm ci · lint · 24 tests vs mongo:7 service container)
                  ├─ frontend  (npm ci · vite build · upload dist artifact)
                  ├─ monitoring(promtool check rules/config · dashboards JSON + drift · compose config)
                  ├─ docker    (needs backend+frontend) buildx build both images with GHA layer cache
                  └─ smoke-test(needs docker+monitoring) docker compose up --wait
                                 ├ frontend serves index.html, /api/health = UP
                                 ├ login through nginx proxy, /api/dashboard returns stats
                                 ├ 45 s synthetic traffic
                                 ├ Prometheus: up{job="resourcehub-api"} == 1, requests > 50, rh_resources > 0
                                 └ Grafana: datasource health OK, both dashboards provisioned
main / v* tag ──► CD ─ build multi-arch images ─► ghcr.io/<owner>/resourcehub-{backend,frontend}
                       tag v* ─► GitHub Release with pull commands
any push / PR / CI result ──► Jira workflow (see JIRA.md)
```

## Why each step exists
- **Ephemeral MongoDB service container**: the tests run against a real database without exposing any cloud credentials, and every test file uses its own throw-away database.
- **`promtool` checks**: a typo in an alert rule would otherwise only be found when Prometheus fails to start.
- **Dashboard drift check**: `build_dashboards.py` is the source of truth. CI fails if someone edits the JSON by hand and forgets the generator.
- **Smoke test**: proves that the *integration* works (nginx → API → Mongo, Prometheus → API, Grafana → Prometheus), not just the individual units.
- **Concurrency group**: a newer push cancels the older run on the same branch.
- **Least privilege**: CI has `contents: read`. Only CD gets `packages: write`. Untrusted strings such as PR titles reach scripts through env vars, never inline `${{ }}`, which prevents script injection.

## Deploying a published version (any Docker host, still no Kubernetes)
```bash
export REGISTRY=ghcr.io/<owner> TAG=1.0.0
docker compose pull backend frontend
docker compose up -d --no-build
```

## Recommended branch protection (Settings → Branches → `main`)
- Require a pull request before merging, with 1 approval
- Require status checks to pass: *Backend - lint & test*, *Frontend - build*, *Docker - build images*, *Full stack smoke test*
