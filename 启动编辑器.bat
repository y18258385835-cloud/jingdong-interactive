@echo off
chcp 65001 >nul
title 鲸动交互平台 - 启动脚本
echo ========================================
echo   鲸动交互平台 开发服务器启动脚本
echo ========================================
echo.

cd /d "%~dp0"

:: 检查 3000 端口是否已在运行
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel%==0 (
    echo [信息] 开发服务器已在运行，直接打开浏览器...
    echo.
    start "" "http://localhost:3000"
    timeout /t 3 /nobreak >nul
    exit /b
)

:: 启动后台服务
start "AETHER-Backend" cmd /c "node server/index.js"

:: 启动开发服务器
echo [启动] 正在启动开发服务器，请稍候...
echo.
start "鲸动交互平台 Dev Server" cmd /k "cd /d "%~dp0" && npm run dev"

:: 等待服务器启动
echo [等待] 等待服务器就绪...
set /a count=0
:check
timeout /t 2 /nobreak >nul
set /a count+=1
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel%==0 goto ready
if %count% lss 15 goto check

echo [警告] 服务器启动超时，请检查上方窗口中的错误信息。
echo        如果端口被占用，请关闭占用程序后重试。
echo.
pause
exit /b

:ready
echo [成功] 服务器已就绪！正在打开浏览器...
echo        地址: http://localhost:3000
echo        关闭黑色命令行窗口即可停止服务器
echo.
start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul
exit /b