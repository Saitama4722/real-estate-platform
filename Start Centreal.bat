@echo off
rem ===========================================================================
rem  Start Centreal - double-click launcher (native local dev, no Docker)
rem  Runs scripts\start_local.ps1, which:
rem    - ensures the PostgreSQL + Memurai Windows services are running
rem    - opens a Django window (127.0.0.1:8001), a Next.js window (:3000),
rem      and a Celery worker window (background tasks, -P solo)
rem    - opens http://localhost:3000 in your browser automatically
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
