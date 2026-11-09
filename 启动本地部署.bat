@echo off
chcp 65001 >nul
title 鲸动交互平台 - 本地部署
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败：请检查端口占用、Node.js 和浏览器权限设置。
  pause
)
