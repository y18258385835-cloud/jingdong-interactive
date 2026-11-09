@echo off
chcp 65001 >nul
title AETHER Editor and License Server
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 pause
