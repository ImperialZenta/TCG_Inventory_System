#!/bin/sh
set -e

echo "Applying database schema..."
MIGRATION_COUNT=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

if [ "$MIGRATION_COUNT" -gt 0 ]; then
  set +e
  DEPLOY_OUTPUT=$(npx prisma migrate deploy 2>&1)
  DEPLOY_EXIT=$?
  set -e

  if [ "$DEPLOY_EXIT" -ne 0 ]; then
    if echo "$DEPLOY_OUTPUT" | grep -q "P3005"; then
      echo "Existing database without migration history; syncing schema and baselining..."
      npx prisma db push --accept-data-loss
      for migration_dir in prisma/migrations/*/; do
        [ -d "$migration_dir" ] || continue
        migration_name=$(basename "$migration_dir")
        echo "Marking migration as applied: $migration_name"
        npx prisma migrate resolve --applied "$migration_name"
      done
    else
      echo "$DEPLOY_OUTPUT"
      exit 1
    fi
  fi
else
  npx prisma db push --accept-data-loss
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  npm run db:seed
fi

echo "Starting application..."
exec node server.js
