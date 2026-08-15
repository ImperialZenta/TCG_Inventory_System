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

Store workflow lives in the app itself: intake bulk → staging → formalize → seal blocks →
**upload session** (select sealed blocks, export Mana Pool CSV, upload at manapool.com, complete
session to activate) → import orders (button, webhook, or cron) → pick → ship.

Per-block CSV export (PL-005) remains for ad-hoc single bricks. Full runbook:
[Listing sealed blocks (Phase 5b)](#listing-sealed-blocks-phase-5b).

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

## Listing sealed blocks (Phase 5b)

[Epic 22](../backlog/epic-22-channel-catalogs.md) · [ADR-013](../architecture/adr/013-channel-catalogs-block-listing.md).

### Mana Pool import behavior

Mana Pool CSV import **adds to or updates** your seller inventory — it does **not** replace the
entire catalog. Re-importing the same printing merges quantities. Upload sessions therefore include
**SEALED blocks only** — never blocks already **ACTIVE** (already listed).

### Recommended workflow

1. **Intake** — staging → formalize → **seal** blocks (do not activate yet).
2. **Configure catalogs (optional)** — assign bins to Mana Pool / TCGplayer channel catalogs in
   `/catalogs` for faster block selection. Rename catalog labels on that page if the placeholder
   name no longer fits.
3. **Upload session** — `/uploads` → new session → select SEALED blocks → choose channel →
   **Generate CSV** (blocks are reserved; picks skip them until complete or cancel).
4. **External upload** — import CSV at [manapool.com/seller/inventory/import](https://manapool.com/seller/inventory/import).
   Verify rows and prices look correct.
5. **Complete session** — confirm in the app → blocks become **ACTIVE** on that channel.

Per-block **Download CSV** on block detail (PL-005) still works for one-off listing without an
upload session.

### Integrity notes

- The app **does not verify** Mana Pool accepted the file. Complete only after you checked MP.
- **Cancel** after uploading to MP may leave marketplace qty live while blocks stay SEALED in the app.
- Per-block CSV on block detail (PL-005) still works for one-off exports; reserved blocks remain
  pick-gated if they are in an open upload session.

### Taking a block offline (Mana Pool)

**Take offline** in the app (`ACTIVE → ARCHIVED`) stops treating the block as live listing context
for picks. It **does not** remove or change quantity on Mana Pool — you must delist manually.

1. **Export** seller inventory from Mana Pool in **ManaBox format**:
   [manapool.com/seller/inventory](https://manapool.com/seller/inventory) → Export listings.
2. **Edit the CSV** — find printings that came from this block. Set quantity to **0** or remove
   those rows. Mana Pool **merges** quantities across blocks: one CSV row may represent cards from
   several ACTIVE blocks, so reduce totals carefully rather than assuming one row equals one block.
3. **Re-import** the edited file at
   [manapool.com/seller/inventory/import](https://manapool.com/seller/inventory/import), **or** turn
   on **vacation mode** on Mana Pool if you are pausing all listings temporarily.

The block detail **Take offline** action shows this checklist for ACTIVE Mana Pool blocks and
requires acknowledgment before archiving. The app never claims the marketplace was updated.
