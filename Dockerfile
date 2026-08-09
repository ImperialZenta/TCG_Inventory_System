FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Ignore lifecycle scripts during install (blocks preinstall dropper worms); run Prisma explicitly.
RUN npm ci --ignore-scripts && npx prisma generate

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Full source tree for running Vitest against PostgreSQL (not used in production).
FROM builder AS test
RUN apk add --no-cache postgresql-client
COPY scripts/docker-test-entrypoint.sh /app/scripts/docker-test-entrypoint.sh
RUN sed -i 's/\r$//' /app/scripts/docker-test-entrypoint.sh && chmod +x /app/scripts/docker-test-entrypoint.sh
ENV NODE_ENV=test
WORKDIR /app
ENTRYPOINT ["/app/scripts/docker-test-entrypoint.sh"]
CMD ["npm", "test"]

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/db-apply.mjs ./scripts/db-apply.mjs
# `npm run db:seed` runs prisma/seed.ts with tsx, which imports the auth bootstrap
# from src. Without these the seed script cannot resolve its own imports.
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh && mkdir -p /app/backups && chown -R nextjs:nodejs /app/backups /app/prisma /app/node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
