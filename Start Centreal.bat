@echo off
rem ===========================================================================
rem  Start Centreal - double-click launcher (native local dev, no Docker)
rem  Runs scripts\start_local.ps1, which:
rem    - ensures the PostgreSQL + Memurai Windows services are running
rem    - picks free ports (prefers 8001 / 3000, walks upward if one is busy)
rem      and keeps frontend\.env.local pointed at whatever it picked
rem    - opens a Django window, a Next.js window, and a Celery worker window
rem      (background tasks, -P solo)
rem    - opens the frontend in your browser automatically. The port is usually
rem      3000, but if something else holds it the launcher moves to 3001/3002/...
rem      - the URL it actually used is printed in the summary at the end.
rem  Just double-click this file from Windows Explorer. No terminal needed.
rem ===========================================================================
title Start Centreal

set "SCRIPT=%~dp0scripts\start_local.ps1"
if not exist "%SCRIPT%" (
  echo ERROR: Could not find start_local.ps1 at:
  echo   "%SCRIPT%"
  echo Keep this file in the project root, next to the "scripts" folder.
  echo.
  pause
  exit /b 1
)

rem Prefer PowerShell 7 (pwsh) if installed; fall back to Windows PowerShell 5.1.
set "PS=powershell"
where pwsh >nul 2>&1 && set "PS=pwsh"

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo Startup reported an error ^(exit code %RC%^). See the messages above.
  pause
)
exit /b %RC%
