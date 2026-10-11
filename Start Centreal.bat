@echo off
rem ===========================================================================
rem  Start Centreal - double-click launcher (native local dev, no Docker)
rem
rem  This project is LOCAL-ONLY. Railway is no longer used; nothing here
rem  references it.
rem
rem  Runs scripts\start_local.ps1, which:
rem    - ensures the PostgreSQL + Memurai Windows services are running
rem    - PREFLIGHTS the two FIXED ports and names whoever owns them:
rem        frontend (Next.js) -> localhost:3001
rem        backend  (Django)  -> 127.0.0.1:8001
rem      Ports 3000 and 8000 are permanently held on this machine by unrelated
rem      third-party software (a VS Code java helper and "Manager"), so they
rem      are never used and the launcher never "walks" to another port. A stale
rem      Centreal dev server on 3001/8001 is terminated; ANY other owner is
rem      reported and that one service is skipped - never a blind kill by port.
rem    - opens three windows: "Centreal Backend", "Centreal Frontend",
rem      "Centreal Celery". Each stays open even if its process dies, so a
rem      traceback remains readable instead of the window vanishing.
rem    - waits for the backend to answer, then the frontend, and only then
rem      opens the browser at http://localhost:3001
rem
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

rem RC 1 means the stack did not come up cleanly. Hold the window open so the
rem per-stage progress lines and the reason stay on screen.
if not "%RC%"=="0" (
  echo.
  echo ---------------------------------------------------------------------
  echo  Startup did not complete cleanly ^(exit code %RC%^).
  echo  Read the [FAIL] / [WARN] lines above: they name which service failed
  echo  and which window holds its traceback.
  echo ---------------------------------------------------------------------
  echo.
  pause
)
exit /b %RC%
