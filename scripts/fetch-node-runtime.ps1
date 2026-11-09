# Fetch the official Node.js Windows runtime used by the desktop installer.
# The launcher prefers runtime\node.exe so users never need to install Node.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\fetch-node-runtime.ps1
param(
  [string]$NodeVersion = "v22.14.0",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeDir = Join-Path $root "runtime"
$target = Join-Path $runtimeDir "node.exe"

if ((Test-Path $target) -and (-not $Force)) {
  Write-Host "[runtime] runtime\node.exe 已存在，跳过下载（--Force 可强制刷新）"
  exit 0
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$arch = "win-x64"
$zipName = "node-$NodeVersion-$arch.zip"
$base = "https://nodejs.org/dist/$NodeVersion"
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("aether-node-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temp | Out-Null

try {
  Write-Host "[runtime] 下载 $base/$zipName"
  $zip = Join-Path $temp $zipName
  Invoke-WebRequest -Uri "$base/$zipName" -OutFile $zip -UseBasicParsing

  Write-Host "[runtime] 校验 SHA256"
  $shasums = Join-Path $temp "SHASUMS256.txt"
  Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -OutFile $shasums -UseBasicParsing
  $expected = (Get-Content $shasums | Where-Object { $_ -match [regex]::Escape($zipName) + "$" } | ForEach-Object { ($_ -split "\s+")[0] } | Select-Object -First 1)
  if (-not $expected) { throw "SHASUMS256.txt 中未找到 $zipName" }
  $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLower()
  if ($actual -ne $expected.ToLower()) { throw "SHA256 校验失败: $actual != $expected" }

  Write-Host "[runtime] 解压 node.exe"
  Expand-Archive -Path $zip -DestinationPath $temp -Force
  $extracted = Join-Path $temp ("node-$NodeVersion-$arch\node.exe")
  if (-not (Test-Path $extracted)) { throw "压缩包内未找到 node.exe" }
  Copy-Item -Path $extracted -Destination $target -Force

  $version = & $target --version
  Write-Host "[runtime] 完成：runtime\node.exe ($version)"
}
finally {
  Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
}
