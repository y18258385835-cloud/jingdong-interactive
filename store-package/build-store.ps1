[CmdletBinding()]
param(
  [string]$ApiBaseUrl = 'https://jd-hub.top',
  [string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$store = $PSScriptRoot
$api = $ApiBaseUrl.TrimEnd('/')

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   AETHER 鲸动交互平台 - 官方发布打包 (阳枫)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "API 接口地址: $api" -ForegroundColor Yellow
Write-Host ""

# 1. 检查 Rust 环境
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
  Write-Host "[错误] 未检测到 Rust 编译工具链 (cargo)。" -ForegroundColor Red
  exit 1
}

Write-Host "[1/4] 构建生产前端资源 (接入 $api)..." -ForegroundColor Cyan
$env:VITE_API_BASE_URL = $api
$env:VITE_REALTIME_API = $api
$env:VITE_BASE = './'

Push-Location $root
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally {
  Pop-Location
}

Write-Host "[2/4] 同步前端资源到 Tauri 构建目录..." -ForegroundColor Cyan
$dist = Join-Path $store 'dist'
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
Copy-Item -Recurse (Join-Path $root 'dist') $dist

Write-Host "[3/4] 调用 Tauri 编译原生桌面安装包 (EXE / MSI)..." -ForegroundColor Cyan
Push-Location $store
try {
  npx tauri build
  if ($LASTEXITCODE -ne 0) { throw 'Tauri build failed' }
} finally {
  Pop-Location
}

Write-Host "[4/4] 导出安装包成品..." -ForegroundColor Cyan
$artifacts = Join-Path $store 'artifacts'
if (-not (Test-Path $artifacts)) {
  New-Item -ItemType Directory -Path $artifacts | Out-Null
}

$bundlePath = Join-Path $store 'src-tauri\target\release\bundle'
if (-not (Test-Path $bundlePath)) {
  $bundlePath = Join-Path $store 'target\release\bundle'
}

$installers = Get-ChildItem -Path $bundlePath -Recurse -Include '*.msi', '*.exe' -ErrorAction SilentlyContinue
if ($installers) {
  $installers | Copy-Item -Destination $artifacts -Force
  Write-Host "打包成功！已生成以下安装包：" -ForegroundColor Green
  foreach ($item in $installers) {
    Write-Host " -> $($item.FullName)" -ForegroundColor Green
  }
} else {
  Write-Host "未在 bundle 目录找到打包文件，请检查编译日志。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  打包完成！输出目录: $artifacts" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
