# Full backup of the PRODUCTION store database (pg_dump custom format).
# Scope: production stack only (compose project tcg-prod, database tcg_inventory).
# Output: backups/store/tcg-store-<timestamp>-<git ref>.dump on the host.
# Runbook: docs/operations/STORE-OPERATIONS.md
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/backup-store.ps1 [-Keep 30]

param(
    # How many dump files to retain in backups/store (oldest pruned first).
    [int]$Keep = 30
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$composeArgs = @("compose", "-f", "docker-compose.prod.yml")

# Fail early if the prod database container is not running.
$dbState = docker @composeArgs ps --status running --services 2>$null
if (-not ($dbState -match "^db$")) {
    Write-Error "Production db container is not running. Start it with: docker compose -f docker-compose.prod.yml up -d"
}

$gitRef = (git describe --tags --always 2>$null)
if (-not $gitRef) { $gitRef = "untagged" }
$gitRef = $gitRef -replace "[^A-Za-z0-9._-]", "_"

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$fileName = "tcg-store-$timestamp-$gitRef.dump"

New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot "backups\store") | Out-Null

Write-Host "Dumping production database to backups/store/$fileName ..."
docker @composeArgs exec -T db pg_dump -U tcg -d tcg_inventory -Fc -f "/backups/$fileName"
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed (exit $LASTEXITCODE). No backup was written."
}

$dumpFile = Get-Item (Join-Path $repoRoot "backups\store\$fileName")
$sizeMb = [math]::Round($dumpFile.Length / 1MB, 2)
Write-Host "Backup complete: $($dumpFile.FullName) ($sizeMb MB)"

# Retention: keep the newest $Keep dumps.
$dumps = Get-ChildItem (Join-Path $repoRoot "backups\store") -Filter "tcg-store-*.dump" |
    Sort-Object LastWriteTime -Descending
if ($dumps.Count -gt $Keep) {
    $dumps | Select-Object -Skip $Keep | ForEach-Object {
        Write-Host "Pruning old backup: $($_.Name)"
        Remove-Item $_.FullName
    }
}

Write-Host "Done. $([math]::Min($dumps.Count, $Keep)) backup(s) retained in backups/store."
