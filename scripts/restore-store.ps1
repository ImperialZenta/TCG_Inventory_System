# DESTRUCTIVE: restore the PRODUCTION store database from a pg_dump archive.
# Scope: production stack only (compose project tcg-prod, database tcg_inventory).
# Replaces ALL current store data with the backup's contents.
# Runbook: docs/operations/STORE-OPERATIONS.md
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/restore-store.ps1 `
#       -File tcg-store-2026-08-09-1200-store-v1.dump -ConfirmRestore RESTORE

param(
    # Dump file: a name inside backups/store, or a full path to a file in that folder.
    [Parameter(Mandatory = $true)]
    [string]$File,

    # Must be the literal string RESTORE. Explicit-scope guard for a destructive op.
    [Parameter(Mandatory = $true)]
    [string]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

node (Join-Path $PSScriptRoot "destructive-scope.mjs") restore $ConfirmRestore
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$fileName = Split-Path -Leaf $File
$hostPath = Join-Path $repoRoot "backups\store\$fileName"
if (-not (Test-Path $hostPath)) {
    Write-Error "Backup file not found: $hostPath"
}

$composeArgs = @("compose", "-f", "docker-compose.prod.yml")

$dbState = docker @composeArgs ps --status running --services 2>$null
if (-not ($dbState -match "^db$")) {
    Write-Error "Production db container is not running. Start it with: docker compose -f docker-compose.prod.yml up -d db"
}

Write-Host "Stopping the store app so no connections hold the database..."
docker @composeArgs stop app

Write-Host "Restoring $fileName into tcg_inventory (drops and recreates all objects)..."
docker @composeArgs exec -T db pg_restore --clean --if-exists -U tcg -d tcg_inventory "/backups/$fileName"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "pg_restore exited with code $LASTEXITCODE. Review the output above; --clean can emit ignorable notices, but errors mean an incomplete restore."
}

Write-Host "Restarting the store app..."
docker @composeArgs start app

Write-Host "Restore finished. Smoke check the store at http://localhost:3000 (login, blocks, orders)."
Write-Host "If the backup predates the current schema, rebuild the app from the matching git tag first (see runbook: Upgrades and rollback)."
