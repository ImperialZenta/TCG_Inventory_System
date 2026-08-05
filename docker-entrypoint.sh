#!/bin/sh
set -e

mark_all_migrations_applied() {
  for migration_dir in prisma/migrations/*/; do
    [ -d "$migration_dir" ] || continue
    migration_name=$(basename "$migration_dir")
    echo "Marking migration as applied: $migration_name"
    npx prisma migrate resolve --applied "$migration_name" 2>/dev/null || true
  done
}

apply_schema() {
  MIGRATION_COUNT=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

  if [ "$MIGRATION_COUNT" -eq 0 ]; then
    npx prisma db push --accept-data-loss
    return
  fi

  set +e
  DEPLOY_OUTPUT=$(npx prisma migrate deploy 2>&1)
  DEPLOY_EXIT=$?
  set -e

  if [ "$DEPLOY_EXIT" -eq 0 ]; then
    return
  fi

  echo "$DEPLOY_OUTPUT"

  if echo "$DEPLOY_OUTPUT" | grep -q "P3005"; then
    echo "Existing database without migration history; syncing schema and baselining..."
    npx prisma db push --accept-data-loss
    mark_all_migrations_applied
    return
  fi

  if echo "$DEPLOY_OUTPUT" | grep -q "P3009"; then
    echo "Recovering from failed migration (P3009)..."
    FAILED=$(echo "$DEPLOY_OUTPUT" | sed -n "s/.*The '\\([^']*\\)' migration.*failed.*/\\1/p" | head -1)
    if [ -n "$FAILED" ]; then
      echo "Rolling back failed migration record: $FAILED"
      npx prisma migrate resolve --rolled-back "$FAILED" || true
    fi

    set +e
    RETRY_OUTPUT=$(npx prisma migrate deploy 2>&1)
    RETRY_EXIT=$?
    set -e

    if [ "$RETRY_EXIT" -eq 0 ]; then
      echo "$RETRY_OUTPUT"
      return
    fi

    echo "$RETRY_OUTPUT"
    echo "migrate deploy still failing; syncing schema with db push..."
    npx prisma db push --accept-data-loss
    mark_all_migrations_applied
    return
  fi

  exit 1
}

echo "Applying database schema..."
apply_schema

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  npm run db:seed
fi

echo "Starting application..."
exec node server.js
