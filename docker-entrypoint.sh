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

  # Production guard (ADR-011): never reshape a database that already holds data.
  # Empty first-boot is the one exception — the migration history starts with ALTER
  # statements (no baseline CREATE), so a brand-new store must be baselined once
  # via db push + mark-applied, after which only migrate deploy runs.
  if [ "$MIGRATE_STRICT" = "true" ]; then
    if [ "$MIGRATION_COUNT" -eq 0 ]; then
      echo "MIGRATE_STRICT=true but no migrations found in prisma/migrations; refusing to db push." >&2
      exit 1
    fi

    set +e
    STRICT_OUTPUT=$(npx prisma migrate deploy 2>&1)
    STRICT_EXIT=$?
    set -e

    if [ "$STRICT_EXIT" -eq 0 ]; then
      echo "$STRICT_OUTPUT"
      return
    fi

    echo "$STRICT_OUTPUT"

    # Count application tables (anything other than Prisma's own migration ledger).
    APP_TABLES=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRawUnsafe(
  \"SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'\"
).then(async (rows) => {
  process.stdout.write(String(rows[0].c));
  await p.\$disconnect();
}).catch(async () => {
  process.stdout.write('unknown');
  await p.\$disconnect();
});
")

    if [ "$APP_TABLES" = "0" ]; then
      echo "MIGRATE_STRICT: empty database (first boot). Baselining schema, then marking migrations applied."
      node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$executeRawUnsafe('DELETE FROM \"_prisma_migrations\"')
  .then(() => p.\$disconnect())
  .catch(async () => { await p.\$disconnect(); });
"
      npx prisma db push --accept-data-loss
      mark_all_migrations_applied
      return
    fi

    echo "MIGRATE_STRICT=true: migrate deploy failed against a non-empty database; refusing db push." >&2
    echo "Restore from backups/store or resolve the migration manually (see docs/operations/STORE-OPERATIONS.md)." >&2
    exit 1
  fi

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
