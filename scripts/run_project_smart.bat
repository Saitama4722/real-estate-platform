@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ---------------------------------------------------------------------------
rem Smart one-click runner: Docker Desktop (if needed) + docker compose up
rem Repo root = parent of this script's directory (safe when double-clicked).
rem ---------------------------------------------------------------------------
cd /d "%~dp0.."
if not exist "docker-compose.yml" (
  echo ERROR: docker-compose.yml not found next to scripts folder.
  echo Expected layout: repo root\docker-compose.yml and repo root\scripts\%~nx0
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker CLI not found in PATH. Install Docker Desktop or add docker to PATH.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Real Estate Platform — local runner
echo ========================================
echo.

echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 goto docker_start_and_wait
echo Docker is ready.
goto docker_ready

:docker_start_and_wait
echo Docker not running. Starting...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
  echo Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
  echo WARNING: Docker Desktop.exe not found at default path.
  echo Start Docker Desktop manually, or install it. Waiting for daemon anyway...
)
echo Waiting for Docker...
set "DOCKER_WAIT=0"

:wait_docker
if !DOCKER_WAIT! geq 120 (
  echo ERROR: Timed out waiting for Docker ^(~6 minutes^). Is Docker Desktop installed?
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 (
  set /a DOCKER_WAIT+=1
  echo   ... still waiting ^(!DOCKER_WAIT!/120^)
  goto wait_docker
)
echo Docker is ready.

:docker_ready
echo.
echo Starting project...
echo Opening browser... ^(after ~5 second delay^)
echo Press Ctrl+C to stop.
echo.

start /min "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000/"

docker compose up --build
set "COMPOSE_EXIT=!ERRORLEVEL!"

echo.
if !COMPOSE_EXIT! neq 0 (
  echo docker compose exited with code !COMPOSE_EXIT!.
)
echo Running cleanup: docker compose down...
docker compose down
echo Done.
echo.
pause
exit /b !COMPOSE_EXIT!
