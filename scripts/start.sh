#!/usr/bin/env bash
# One-command start for Linux / macOS / Git Bash.  Usage: ./scripts/start.sh [--demo]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
PROFILE=""
[ "${1:-}" = "--demo" ] && PROFILE="--profile demo"
docker compose $PROFILE up -d --build --wait
echo
echo "  App ........ http://localhost:8080   (admin@resourcehub.com / Admin@123)"
echo "  API ........ http://localhost:5000/api/health"
echo "  Prometheus . http://localhost:9090/targets"
echo "  Grafana .... http://localhost:3000   (admin / admin)"
