# Store operations runbook

How to run the real store (production) alongside development without ever putting store
data at risk. Architecture rationale: [ADR-011](../architecture/adr/011-production-dev-environment-separation.md) · Story: PL-009.

## Coming back after a break (start here)

Forgot how this all works? The short version:

- Your **store** runs at **http://localhost:3000** from the `tcg-prod` Docker stack. Its data
  lives on the external volume `tcg_prod_pgdata`, which normal Docker cleanup commands cannot delete.
- **Dev** runs at **http://localhost:3010** from the default stack. It has its own database and
  physically cannot touch store data.
- **Backups** are `pg_dump` files in `backups/store/`. One command creates them, one command restores them.

Three checks to reorient yourself:

```powershell
# 1. Is the store running? (expect db and app both "running")
docker compose -f docker-compose.prod.yml ps

# 2. When was the last backup? (check the newest file's date)
Get-ChildItem backups\store | Sort-Object LastWriteTime -Descending | Select-Object -First 5

# 3. What version is the store on? (dump filenames embed the git ref; or check the tag)
git tag --list "store-v*" | Select-Object -Last 3
```

If the store is not running: `docker compose -f docker-compose.prod.yml up -d` (no `--build` — that
would deploy whatever code is in your working tree; see Upgrades below).

## Daily operations

| Task | Command |
|---|---|
| Start the store | `docker compose -f docker-compose.prod.yml up -d` |
| Stop the store (data survives) | `docker compose -f docker-compose.prod.yml down` |
| Take a backup | `powershell -ExecutionPolicy Bypass -File scripts/backup-store.ps1` |
| Tail store logs | `docker compose -f docker-compose.prod.yml logs -f app` |

Store workflow lives in the app itself: intake bulk → staging → blocks → activate → export the
block's Mana Pool CSV and upload it → import orders (button, webhook, or cron) → pick → ship.

### Backup cadence

- **Nightly automatic** (recommended): Windows Task Scheduler, run as your user, daily at 2 AM:

```powershell
schtasks /Create /TN "TCG Store Nightly Backup" /SC DAILY /ST 02:00 `
  /TR "powershell -ExecutionPolicy Bypass -File C:\AI\TCG_Inventory_System\scripts\backup-store.ps1"
```

- **Manual**: before and after any big intake session, before any upgrade, before anything that
  makes you nervous. Backups are cheap; run the script freely.
- Retention: the script keeps the newest 30 dumps (override with `-Keep`).
- The Settings-page **JSON export** is a secondary, human-readable snapshot of inventory structure
  only — it does **not** contain orders, pick history, users, or the event ledger. The `pg_dump`
  archive is the real disaster-recovery backup.

## Restore ("oops" recovery)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-store.ps1 `
  -File <name>.dump -ConfirmRestore RESTORE
```

This stops the store app, replaces the entire production database with the backup's contents, and
restarts the app. You lose anything that happened after that backup was taken. If the dump predates
schema changes, first rebuild the store from the matching git tag (the tag is embedded in the dump
filename), restore, then upgrade normally.

Note: fat-fingering `docker compose down -v` against the prod stack is a **non-event** — the volume
is external and survives. Restore exists for deeper disasters (volume manually deleted, disk loss,
bad data entered in bulk).

## Upgrades: moving dev work into the store

All schema changes must exist as Prisma migrations (created on dev with `npm run db:migrate:dev`)
before they can reach the store. The store applies them with `prisma migrate deploy`, which
upgrades existing data in place — no re-scanning cards, no rebuilding blocks.

1. All tests green on dev (`docker compose --profile test run --rm test`) and spec compliance done.
2. Commit and tag: `git tag store-vN && git push origin store-vN`.
3. Backup: `powershell -ExecutionPolicy Bypass -File scripts/backup-store.ps1`.
4. Deploy from the tag (clean checkout, never a dirty working tree):

```powershell
git status   # must be clean
git checkout store-vN
docker compose -f docker-compose.prod.yml up -d --build
git checkout main
```

5. Watch startup: `docker compose -f docker-compose.prod.yml logs -f app` — you should see
   `prisma migrate deploy` succeed. If migration fails against a store that already has data, the
   container exits instead of touching it (`MIGRATE_STRICT`). First boot of an empty database is
   the one exception: the entrypoint baselines once (migration history has no CREATE baseline).
6. Smoke check: login, blocks list, an order detail, a pick list.
7. **Rollback**: `git checkout store-v(N-1)`, rebuild the stack, then restore the pre-upgrade dump
   with `restore-store.ps1`.
8. **Pre-first-upgrade drill (PL-009):** before your first ever prod upgrade, run a full backup →
   restore roundtrip on a post-backup drill and log the result in [SMOKE-LOG.md](SMOKE-LOG.md).
   Verify orders, users, and inventory survive the restore before you rely on dumps in production.

## Hard rules

1. **Never** run `prisma db push` against the production database. `MIGRATE_STRICT=true` in
   `docker-compose.prod.yml` enforces this at the entrypoint.
2. Every schema change becomes a migration file on dev **first**.
3. The store is only (re)built from a `store-vN` tag — `--build` from a dirty tree deploys
   half-finished work onto real data.
4. Danger-zone buttons and the restore form in the UI at **port 3000** operate on real store data.
   The same screens at port 3010 are dev and fair game.
5. `docker volume prune` / `docker system prune --volumes` can delete the store volume if the prod
   stack happens to be stopped. Don't run prune commands casually; back up first.

## First-boot setup (fresh store)

1. `docker volume create tcg_prod_pgdata`
2. `Copy-Item .env.prod.example .env.prod` and fill in Mana Pool credentials + secrets.
3. `docker compose -f docker-compose.prod.yml up -d --build` (from a tagged release).
4. Visit http://localhost:3000 → redirected to `/setup` → create the owner account.
5. Settings → create shelves and bins; adjust staging target if desired.
6. Take backup #1: `powershell -ExecutionPolicy Bypass -File scripts/backup-store.ps1`.
7. Create the nightly backup task (command above).
8. Start intake.
