$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')
$TargetExe = "D:\AETHER交互程序新版本\-media-main - 更换Codex更换gemini\鲸动交互平台.exe"
$WorkingDir = "D:\AETHER交互程序新版本\-media-main - 更换Codex更换gemini"
$IconFile = "D:\AETHER交互程序新版本\-media-main - 更换Codex更换gemini\store-package\src-tauri\icons\icon.ico"

$Shortcut = $WshShell.CreateShortcut((Join-Path $Desktop "鲸动交互平台.lnk"))
$Shortcut.TargetPath = $TargetExe
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.IconLocation = "$IconFile,0"
$Shortcut.Description = "鲸动交互平台 - AETHER 桌面客户端"
$Shortcut.Save()

Write-Host "桌面快捷方式已成功创建: $(Join-Path $Desktop '鲸动交互平台.lnk')" -ForegroundColor Green
