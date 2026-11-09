@echo off
chcp 65001 >nul
title 鲸动交互平台 - Tauri 桌面安装包一键打包

echo ================================================
echo   鲸动交互平台 - Tauri 桌面安装包一键打包
echo ================================================
echo.

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0store-package\build-store.ps1"

if errorlevel 1 (
    echo.
    echo ================================================
    echo   打包中断或失败，请查看上方提示信息。
    echo ================================================
    echo.
)

pause
