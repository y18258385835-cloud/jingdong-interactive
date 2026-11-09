param(
  [int]$FrontendPort = 3000,
  [int]$ProxyPort = 8080
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Port([int]$ListenPort) {
  return [bool](Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue)
}

function Find-AvailablePort([int]$PreferredPort) {
  $candidatePort = $PreferredPort
  while (Test-Port $candidatePort) { $candidatePort += 1 }
  return $candidatePort
}

function Get-ProjectServicePort([string]$CommandMarker) {
  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::', '::1') }
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $parent = if ($process -and $process.ParentProcessId) {
      Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ParentProcessId)" -ErrorAction SilentlyContinue
    }
    $processCommand = if ($process) { $process.CommandLine } else { '' }
    $parentCommand = if ($parent) { $parent.CommandLine } else { '' }
    $belongsToProject = ($processCommand -and $processCommand.Contains($root)) -or ($parentCommand -and $parentCommand.Contains($root))
    if ($belongsToProject -and (($processCommand -match $CommandMarker) -or ($parentCommand -match $CommandMarker))) {
      return [int]$listener.LocalPort
    }
  }
  return $null
}

function Find-AetherLicensePort([int]$PreferredPort) {
  # Node child processes commonly omit the working directory from their command
  # line, so identify our backend from its health contract instead of guessing
  # from a process name. This also finds a previously selected fallback port.
  for ($candidatePort = $PreferredPort; $candidatePort -lt ($PreferredPort + 10); $candidatePort += 1) {
    try {
      $health = Invoke-RestMethod -Uri "http://localhost:$candidatePort/api/health" -TimeoutSec 1
      if ($health.service -eq 'aether-3d-proxy') { return $candidatePort }
    } catch {
      # No compatible service is listening on this candidate port.
    }
  }
  return $null
}

function Find-AetherFrontendPort([int]$PreferredPort) {
  for ($candidatePort = $PreferredPort; $candidatePort -lt ($PreferredPort + 10); $candidatePort += 1) {
    if (-not (Test-Port $candidatePort)) { continue }
    $listener = Get-NetTCPConnection -State Listen -LocalPort $candidatePort -ErrorAction SilentlyContinue | Select-Object -First 1
    $process = if ($listener) { Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue }
    $parent = if ($process -and $process.ParentProcessId) {
      Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ParentProcessId)" -ErrorAction SilentlyContinue
    }
    $processCommand = if ($process) { $process.CommandLine } else { '' }
    $parentCommand = if ($parent) { $parent.CommandLine } else { '' }
    if (($processCommand -match 'vite') -or ($parentCommand -match 'vite')) { return $candidatePort }
    try {
      $page = (Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$candidatePort" -TimeoutSec 6).Content
      if ($page -match 'src="/src/main\.tsx"' -and $page -match 'favicon\.svg') { return $candidatePort }
    } catch {
      # No compatible editor is listening on this candidate port.
    }
  }
  return $null
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22 LTS is required but was not found.'
}
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  npm install --prefix $root
}

$existingFrontendPort = Find-AetherFrontendPort $FrontendPort
$existingProxyPort = Find-AetherLicensePort $ProxyPort
if ($existingFrontendPort -and $existingProxyPort) {
  Write-Host "Reusing existing AETHER services." -ForegroundColor Green
  Start-Process "http://localhost:$existingFrontendPort"
  Start-Process "http://localhost:$existingProxyPort/admin/licenses"
  Write-Host "Editor: http://localhost:$existingFrontendPort" -ForegroundColor Green
  Write-Host "License admin: http://localhost:$existingProxyPort/admin/licenses" -ForegroundColor Green
  exit 0
}

# A previous editor window may still be running while the license process was
# closed. Reuse the editor's port and restore only the missing service.
if ($existingFrontendPort) {
  $FrontendPort = $existingFrontendPort
} elseif (Test-Port $FrontendPort) {
  $FrontendPort = Find-AvailablePort $FrontendPort
  Write-Host "Frontend default port is busy; using $FrontendPort." -ForegroundColor Yellow
}

# Do the same for a running project backend. This avoids opening a stale
# default URL after the launcher selected a fallback port for another process.
if ($existingProxyPort) {
  $ProxyPort = $existingProxyPort
} elseif (Test-Port $ProxyPort) {
  $ProxyPort = Find-AvailablePort $ProxyPort
  Write-Host "License server default port is busy; using $ProxyPort." -ForegroundColor Yellow
}

& (Join-Path $root 'scripts\initialize-local-license.ps1')

if (-not $existingProxyPort) {
  $watchdog = Join-Path $root 'scripts\run-license-server.ps1'
  $watchdogArguments = "-NoExit -ExecutionPolicy Bypass -File `"$watchdog`" -ProjectRoot `"$root`" -Port $ProxyPort"
  Start-Process -FilePath powershell.exe -ArgumentList $watchdogArguments | Out-Null
}
if (-not $existingFrontendPort) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root'; `$env:VITE_API_BASE_URL='http://localhost:$ProxyPort'; npm run dev -- --port $FrontendPort --host 0.0.0.0" | Out-Null
}

for ($attempt = 0; $attempt -lt 15; $attempt += 1) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$ProxyPort/api/health" -TimeoutSec 2 | Out-Null
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not (Test-Port $ProxyPort)) {
  throw "License server did not start on port $ProxyPort. Check the new server window."
}

Start-Process "http://localhost:$FrontendPort"
Start-Process "http://localhost:$ProxyPort/admin/licenses"
Write-Host "Editor: http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "License admin: http://localhost:$ProxyPort/admin/licenses" -ForegroundColor Green
Write-Host "Health check: http://localhost:$ProxyPort/api/health"
