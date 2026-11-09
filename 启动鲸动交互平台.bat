@echo off
chcp 65001 >nul
title 鲸动交互平台 - 启动中...

echo ========================================
echo    鲸动交互平台 正在启动...
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查依赖...
if not exist "node_modules" (
    echo 未找到 node_modules，正在安装依赖，请稍候...
    call npm install
)

echo [2/3] 启动 AI 与系统后台服务 (端口 8080)...
start "鲸动交互平台-后台服务" cmd /c "node server/index.js"

echo [3/3] 启动前端编辑器服务器 (端口 3000)...
start "鲸动交互平台-前端服务" cmd /k "npm run dev"

echo 等待服务器启动就绪...
timeout /t 3 /nobreak >nul

echo 正在打开浏览器...
start http://localhost:3000/

echo.
echo ========================================
echo    启动完成！
echo    前端编辑器: http://localhost:3000/
echo    后台API服务: http://localhost:8080/api/health
echo.
echo    提示：请勿关闭后台黑框，关闭将停止服务。
echo ========================================
echo.
pause
