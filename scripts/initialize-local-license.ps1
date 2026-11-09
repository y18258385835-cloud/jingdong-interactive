param(
  [string]$AdminPassword
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envPath = Join-Path $root '.env'
$licenseDataDirectory = Join-Path $root 'data'

function New-RandomSecret([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-EnvValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -First 1
  if (-not $match) { return $null }
  return ($match -replace "^$([regex]::Escape($Name))=", '').Trim().Trim('"')
}

function Set-EnvValue([System.Collections.Generic.List[string]]$Lines, [string]$Name, [string]$Value) {
  $replacement = "$Name=`"$Value`""
  for ($index = 0; $index -lt $Lines.Count; $index += 1) {
    if ($Lines[$index] -match "^$([regex]::Escape($Name))=") {
      $Lines[$index] = $replacement
      return
    }
  }
  $Lines.Add($replacement)
}

New-Item -ItemType Directory -Path $licenseDataDirectory -Force | Out-Null
$lines = [System.Collections.Generic.List[string]]::new()
if (Test-Path $envPath) {
  [string[]]$existingLines = Get-Content -LiteralPath $envPath
  $lines.AddRange($existingLines)
}

$existingSecret = Get-EnvValue $lines 'LICENSE_SECRET'
$existingPassword = Get-EnvValue $lines 'LICENSE_ADMIN_PASSWORD'
if (-not $existingSecret -or $existingSecret -eq 'replace-with-a-long-random-secret') {
  Set-EnvValue $lines 'LICENSE_SECRET' (New-RandomSecret 48)
}
if (-not $existingPassword -or $existingPassword -eq 'replace-with-a-strong-admin-password') {
  if (-not $AdminPassword) { $AdminPassword = New-RandomSecret 24 }
  Set-EnvValue $lines 'LICENSE_ADMIN_PASSWORD' $AdminPassword
}
Set-EnvValue $lines 'LICENSE_DATA_PATH' './data/licenses.json'
Set-EnvValue $lines 'LICENSE_ADMIN_SESSION_TTL_MS' '28800000'
Set-EnvValue $lines 'LICENSE_TOKEN_TTL_MS' '43200000'
Set-EnvValue $lines 'LICENSE_EXPORT_TOKEN_TTL_MS' '300000'

[System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.UTF8Encoding]::new($false))

try {
  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $envPath /inheritance:r /grant:r "${currentUser}:(R,W)" | Out-Null
} catch {
  Write-Warning 'Unable to restrict .env file permissions. Restrict server access manually.'
}

Write-Host 'License configuration is ready.' -ForegroundColor Green
Write-Host 'The admin password is in .env under LICENSE_ADMIN_PASSWORD. Keep it private.' -ForegroundColor Yellow
