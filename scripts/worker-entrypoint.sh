#!/bin/sh
set -e

echo "Applying database schema..."
npx prisma migrate deploy

echo "Starting worker..."
exec npx tsx src/worker/index.ts
