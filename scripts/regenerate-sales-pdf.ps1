# Regenerate all docs/sales/*.pdf from matching HTML files (requires Microsoft Edge).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$sales = Join-Path $root "docs/sales"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
  $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $edge)) {
  Write-Error "Microsoft Edge not found. Open HTML files in docs/sales and Print to PDF."
}

$targets = @(
  "PRODUCT-OVERVIEW",
  "ROADMAP-AND-FEATURES",
  "AMAZON-6-PAGER"
)

foreach ($name in $targets) {
  $html = Join-Path $sales "$name.html"
  $pdf = Join-Path $sales "$name.pdf"
  if (-not (Test-Path $html)) {
    Write-Warning "Skip $name - missing $html"
    continue
  }
  $uri = "file:///$($html -replace '\\', '/')"
  & $edge --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdf" $uri
  Start-Sleep -Milliseconds 800
  if (Test-Path $pdf) {
    Write-Host "Wrote $pdf"
  } else {
    Write-Warning "Failed to write $pdf"
  }
}
