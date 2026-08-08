#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-tcg}"
DB_PASSWORD="${DB_PASSWORD:-tcg}"
DB_MAIN="${DB_MAIN:-tcg_inventory}"
DB_TEST="${DB_TEST:-tcg_inventory_test}"

echo "Waiting for PostgreSQL at ${DB_HOST}..."
until PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_MAIN" -c '\q' 2>/dev/null; do
  sleep 1
done

echo "Ensuring test database ${DB_TEST} exists..."
EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_MAIN" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${DB_TEST}'")
if [ "$EXISTS" != "1" ]; then
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_MAIN" -c \
    "CREATE DATABASE \"${DB_TEST}\";"
  echo "Created database ${DB_TEST}"
else
  echo "Database ${DB_TEST} already exists"
fi

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_TEST}"

echo "Applying schema to ${DB_TEST}..."
npx prisma db push --accept-data-loss

echo "Running: $*"
exec "$@"
