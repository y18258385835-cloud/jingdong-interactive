@echo off
chcp 65001 >nul
title 鲸动交互平台 - AI 3D 模式

echo ================================================
echo   鲸动交互平台 - AI 3D 模型生成模式
echo ================================================
echo.
echo [1/3] 启动 AI 代理与系统服务 (端口 8080)...
start "AI3D-Proxy" cmd /c "cd /d %~dp0 && node server/index.js"

timeout /t 2 /nobreak >nul

echo [2/3] 启动前端开发服务器 (端口 3000)...
start "AETHER-Vite" cmd /k "cd /d %~dp0 && npx vite --port=3000 --host=0.0.0.0"

echo [3/3] 等待就绪并打开浏览器...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ================================================
echo   代理地址: http://localhost:8080
echo   前端地址: http://localhost:3000
echo   健康检查: http://localhost:8080/api/health
echo ================================================
echo.
echo 提示：在编辑器中点击左侧「3D/全景」→「3D分层(AI)」
echo       即可上传产品图片，AI 自动生成 3D 模型
echo.

pause
