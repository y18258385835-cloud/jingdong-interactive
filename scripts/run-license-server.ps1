param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,
  [Parameter(Mandatory = $true)]
  [int]$Port
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $ProjectRoot

# Keep the license API available while the editor is used. A failed Node
# process is restarted instead of leaving the admin URL silently unavailable.
while ($true) {
  $env:PORT = [string]$Port
  Write-Host "[License server] Starting on http://localhost:$Port" -ForegroundColor Cyan
  & node server/index.js
  $exitCode = $LASTEXITCODE
  Write-Host "[License server] Stopped unexpectedly (exit code $exitCode). Retrying in 3 seconds..." -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}
