@echo off
setlocal
cd /d "%~dp0.."

echo Project: %cd%
echo.
echo [1/3] Installing dependencies...
call npm.cmd install
if errorlevel 1 exit /b 1

echo.
echo [2/3] Registering slash commands...
call npm.cmd run register:commands
if errorlevel 1 exit /b 1

echo.
echo [3/3] Starting bot (dev mode)...
call npm.cmd run dev

