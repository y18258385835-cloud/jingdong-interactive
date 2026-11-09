# Build app_launcher.cs into the desktop launcher.
# Chinese output names get mangled by the console code page, so compile to an
# ASCII name first and rename with PowerShell.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "csc.exe not found: $csc" }

$tempOut = "launcher_build.exe"
if (Test-Path $tempOut) { Remove-Item -Force $tempOut }

& $csc /target:winexe /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll "/win32icon:store-package\src-tauri\icons\icon.ico" "/out:$tempOut" app_launcher.cs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempOut)) { throw "launcher build failed" }

Move-Item -Force $tempOut ([char]0x9CB8 + [char]0x52A8 + [char]0x4EA4 + [char]0x4E92 + [char]0x5E73 + [char]0x53F0 + ".exe")
Write-Host "[launcher] built"
