#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo 'Create .env from .env.example and set JWT_SECRET before starting.' >&2
  exit 1
fi
compose=(docker compose -f docker-compose.dev.yml)
"${compose[@]}" up -d --wait db redis
"${compose[@]}" build app
"${compose[@]}" run --rm --no-deps app pnpm db:generate
"${compose[@]}" run --rm --no-deps app pnpm db:deploy
"${compose[@]}" up -d app worker
"${compose[@]}" logs -f app worker
