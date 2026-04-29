#!/bin/sh
# Run during Vercel builds (production and preview).
# Uses POSTGRES_URL_NON_POOLING as the connection URL so that
# Prisma migrations use a direct connection — Neon's pooled URL
# goes through PgBouncer which blocks advisory locks.
set -e
export POSTGRES_PRISMA_URL="$POSTGRES_URL_NON_POOLING"

# Baseline: mark the initial schema as already applied for databases that
# were bootstrapped with `prisma db push` and have no migration history.
# Safe to run on every deploy — silently succeeds if already resolved.
npx prisma migrate resolve --applied 20260426000000_baseline 2>/dev/null || true

# Apply any pending migrations (DrumScore and future ones).
npx prisma migrate deploy
