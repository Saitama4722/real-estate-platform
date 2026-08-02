#Requires -Version 5.1
# ============================================================================
#  Centreal - Native local development launcher (no Docker)
#  ------------------------------------------------------------------------
#  1. Ensures the PostgreSQL 18 and Memurai (Redis) Windows services run
#  2. Picks free ports (preferring 8001 / 3000, walking upward if busy) and
#     rewrites frontend/.env.local so the site always names the real ports
#  3. Opens three separate PowerShell windows:
#       - Django  (runserver on 127.0.0.1:<backend port>, via the venv's python.exe)
#       - Next.js (dev server on <frontend port>)
#       - Celery worker (-P solo, via the venv's python.exe)
#  4. Confirms the port Next.js really bound, re-syncing/restarting if it drifted
#  5. Waits for the servers to answer, then opens the browser
#  6. Prints the local URLs - ALWAYS read the actual frontend URL from the
#     summary at the end; it is not guaranteed to be :3000
# ============================================================================

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir     = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

# Django binds to 8001 locally because 8000 is taken by another process on this
# machine. The frontend (frontend/.env.local: BACKEND_URL) is rewritten at runtime
# to whatever port Django actually ends up on (see "Resolve free ports" below).
$BackendHost  = "127.0.0.1"

# Preferred starting ports. If one is busy we walk upward (8001 -> 8002 -> ...,
# 3000 -> 3001 -> ...) and use the first free port, so a stale server or another
# app holding the port no longer blocks startup.
$BackendPortPreferred  = 8001
$FrontendPortPreferred = 3000

# --- Find the first free TCP port at or above a starting port ------------
# A port is "free" if nothing is currently listening on it (loopback + any).
# We probe up to $MaxTries ports; if none are free we stop with a clear error
# rather than silently colliding with another process.
function Find-FreePort {
    param(
        [int]$StartPort,
        [int]$MaxTries = 50
    )

    for ($port = $StartPort; $port -lt ($StartPort + $MaxTries); $port++) {
        $inUse = $false
        try {
            # Get-NetTCPConnection is the most reliable check on Windows; a
            # Listen entry on this port means something already owns it.
            $listening = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
            if ($listening) { $inUse = $true }
        } catch {
            $inUse = $false
        }

        if (-not $inUse) {
            # Double-check by actually trying to bind it, in case a listener
            # appeared on an interface Get-NetTCPConnection didn't surface.
            # We bind BOTH loopback and 0.0.0.0 (Any): `next dev` binds all
            # interfaces, so a listener on a non-loopback address would let a
            # loopback-only probe succeed and still collide at launch. Each probe
            # sets ExclusiveAddressUse so Windows' SO_REUSEADDR behaviour cannot
            # hand us a port another process is already serving on.
            $bindOk = $true
            foreach ($addr in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::Any)) {
                $listener = $null
                try {
                    $listener = [System.Net.Sockets.TcpListener]::new($addr, $port)
                    try { $listener.ExclusiveAddressUse = $true } catch { }
                    $listener.Start()
                } catch {
                    # Could not bind - treat as busy and keep walking.
                    $bindOk = $false
                } finally {
                    if ($listener) { try { $listener.Stop() } catch { } }
                }
                if (-not $bindOk) { break }
            }
            if ($bindOk) { return $port }
        }
    }
    return $null
}

function Write-OK   ($m) { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Write-Info ($m) { Write-Host "  [..]   $m" -ForegroundColor Cyan }
function Write-Warn ($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Err  ($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }

Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "   Centreal - Native local development" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Ensure Windows services ------------------------------------------
function Ensure-ServiceRunning {
    param([string]$Name, [string]$Label)

    $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Warn "$Label service '$Name' not found. Is it installed?"
        return
    }
    if ($svc.Status -eq 'Running') {
        Write-OK "$Label already running ($Name)"
        return
    }
    Write-Info "Starting $Label service '$Name'..."
    try {
        Start-Service -Name $Name -ErrorAction Stop
        Start-Sleep -Seconds 1
        Write-OK "$Label started ($Name)"
    } catch {
        Write-Err "Could not start '$Name': $($_.Exception.Message)"
        Write-Warn "Run this script from an elevated (Administrator) PowerShell to start services."
    }
}

Write-Host "  --- Services ---" -ForegroundColor White
Ensure-ServiceRunning -Name "postgresql-x64-18" -Label "PostgreSQL 18"

# Memurai service name is usually 'Memurai'; fall back to a wildcard search.
$memuraiSvc = Get-Service -Name "Memurai" -ErrorAction SilentlyContinue
if (-not $memuraiSvc) {
    $memuraiSvc = Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "*memurai*" -or $_.DisplayName -like "*Memurai*" } |
        Select-Object -First 1
}
if ($memuraiSvc) {
    Ensure-ServiceRunning -Name $memuraiSvc.Name -Label "Memurai (Redis)"
} else {
    Write-Warn "Memurai service not found. Is Memurai installed and running?"
}

# --- 2. Locate the Python virtual environment ----------------------------
Write-Host ""
Write-Host "  --- Backend venv ---" -ForegroundColor White
$venvCandidates = @(
    (Join-Path $BackendDir ".venv"),
    (Join-Path $BackendDir "venv")
)
$venvDir = $null
foreach ($c in $venvCandidates) {
    if (Test-Path (Join-Path $c "Scripts\Activate.ps1")) { $venvDir = $c; break }
}
if ($venvDir) {
    Write-OK "Using virtual environment: $venvDir"
} else {
    Write-Err "No virtual environment found in backend/ (.venv or venv)."
    Write-Warn "Create it once with:"
    Write-Host "      cd backend; python -m venv venv; venv\Scripts\activate; pip install -r requirements.txt" -ForegroundColor DarkGray
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}

# --- 2b. Resolve free ports and sync frontend/.env.local -----------------
Write-Host ""
Write-Host "  --- Ports ---" -ForegroundColor White

$BackendPort = Find-FreePort -StartPort $BackendPortPreferred
if (-not $BackendPort) {
    Write-Err "No free backend port found at or above $BackendPortPreferred."
    Read-Host "  Press Enter to exit"; exit 1
}
if ($BackendPort -ne $BackendPortPreferred) {
    Write-Warn "Backend port $BackendPortPreferred is busy - using $BackendPort instead."
} else {
    Write-OK "Backend will use port $BackendPort"
}

$FrontendPort = Find-FreePort -StartPort $FrontendPortPreferred
if (-not $FrontendPort) {
    Write-Err "No free frontend port found at or above $FrontendPortPreferred."
    Read-Host "  Press Enter to exit"; exit 1
}
if ($FrontendPort -ne $FrontendPortPreferred) {
    Write-Warn "Frontend port $FrontendPortPreferred is busy - using $FrontendPort instead."
} else {
    Write-OK "Frontend will use port $FrontendPort"
}

# Canonical URLs everything downstream (HTTP checks, browser, summary) uses.
$frontendUrl = "http://localhost:$FrontendPort"
$backendUrl  = "http://${BackendHost}:${BackendPort}"

# Next.js reads .env.local at process start, so we must rewrite the port-bearing
# URLs BEFORE launching `npm run dev`. We only touch the four URL lines and leave
# the rest of the file (comments, map keys) untouched. A key that is missing
# entirely is APPENDED rather than skipped, so the file can never end up naming
# only some of the ports. Called again later if Next.js drifts to another port.
$envLocalPath = Join-Path $FrontendDir ".env.local"

function Sync-FrontendEnv {
    param([string]$SiteUrl, [string]$ApiBaseUrl)

    if (-not (Test-Path $envLocalPath)) {
        Write-Warn "frontend/.env.local not found - skipping URL sync."
        return $false
    }

    $wanted = [ordered]@{
        "NEXT_PUBLIC_SITE_URL"  = $SiteUrl
        "NEXT_PUBLIC_API_URL"   = "$SiteUrl/api"
        "BACKEND_URL"           = $ApiBaseUrl
        "BACKEND_INTERNAL_URL"  = $ApiBaseUrl
    }

    try {
        $envLines = @(Get-Content -LiteralPath $envLocalPath)
        $seen = @{}
        $envLines = $envLines | ForEach-Object {
            $line = $_
            foreach ($key in $wanted.Keys) {
                if ($line -match "^\s*$key=") {
                    $seen[$key] = $true
                    $line = "$key=$($wanted[$key])"
                    break
                }
            }
            $line
        }
        # Append any key the file did not already define.
        foreach ($key in $wanted.Keys) {
            if (-not $seen.ContainsKey($key)) {
                $envLines += "$key=$($wanted[$key])"
                Write-Info "Added missing $key to frontend/.env.local"
            }
        }
        Set-Content -LiteralPath $envLocalPath -Value $envLines -Encoding UTF8
        Write-OK "Synced frontend/.env.local (site -> $SiteUrl, backend -> $ApiBaseUrl)"
        return $true
    } catch {
        Write-Warn "Could not update frontend/.env.local: $($_.Exception.Message)"
        Write-Warn "The site may use a stale port - check NEXT_PUBLIC_SITE_URL / BACKEND_URL."
        return $false
    }
}

Sync-FrontendEnv -SiteUrl $frontendUrl -ApiBaseUrl $backendUrl | Out-Null

# --- 3-4b. Launch the three services -------------------------------------
# Django (backend), Next.js (frontend), and a Celery worker (background tasks),
# each in its own PowerShell window. (A single Windows Terminal window with split
# panes was tried and reverted - see the note on the command strings below.)
Write-Host ""
Write-Host "  --- Launching servers ---" -ForegroundColor White

# The venv's own executables. We invoke python.exe by ABSOLUTE PATH rather than
# sourcing Activate.ps1 inline: activation is only needed to put these on PATH,
# and calling them directly is more robust and one less step that can fail.
$venvPython = Join-Path $venvDir "Scripts\python.exe"

# Per-window PowerShell -Command payloads: set a window title, cd into the right
# directory, then run the process. Each opens in its OWN PowerShell window (see
# below). We deliberately do NOT use a single Windows Terminal (wt.exe) with
# split panes: that was tried and reverted - the wt window flashed open and
# closed immediately on this machine (a wt handoff/timing quirk that could not be
# reproduced in isolation), whereas three separate windows are rock-solid.
$backendCmd  = "`$host.UI.RawUI.WindowTitle = 'Centreal Backend (Django :$BackendPort)'; Set-Location -LiteralPath '$BackendDir'; & '$venvPython' manage.py runserver ${BackendHost}:${BackendPort}"
# Bind Next.js to the exact port we picked (already verified free). On Windows
# PowerShell, `npm run dev -- --port` is unreliable because npm's arg pass-through
# gets mangled, so we invoke Next.js directly with `npx next dev --port`. We also
# set $env:PORT as a belt-and-suspenders fallback (Next.js honours PORT too).
function New-FrontendCmd {
    param([int]$Port)
    # NODE_ENV is forced to 'development' because these windows INHERIT the
    # environment of whoever launched the script. A shell carrying
    # NODE_ENV=production puts `next dev` into a state where the CSS/PostCSS
    # loader chain is not wired up, and every page 500s with
    # "Module parse failed: Unexpected character '@'" from globals.css - which
    # looks like a broken build, not an env var. See the NODE_ENV section in
    # CLAUDE.md, which prescribes exactly this guard.
    return "`$host.UI.RawUI.WindowTitle = 'Centreal Frontend (Next.js :$Port)'; Set-Location -LiteralPath '$FrontendDir'; `$env:NODE_ENV = 'development'; `$env:PORT = '$Port'; npx next dev --port $Port"
}
$frontendCmd = New-FrontendCmd -Port $FrontendPort
$workerCmd   = "`$host.UI.RawUI.WindowTitle = 'Centreal Celery worker'; Set-Location -LiteralPath '$BackendDir'; & '$venvPython' -m celery -A config.celery worker -l info -P solo"

# Duplicate guard for the worker: a worker has no listening port, so we detect an
# existing one by scanning process command lines for "celery ... worker". This
# catches a worker started manually or by a previous run. Best-effort (it cannot
# see workers on other machines / containers), which is fine for local dev.
$existingWorker = $null
try {
    $existingWorker = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match 'celery' -and $_.CommandLine -match '\bworker\b' } |
        Select-Object -First 1
} catch {
    $existingWorker = $null
}
$startWorker = -not $existingWorker
if ($existingWorker) {
    Write-Warn "A Celery worker already appears to be running (PID $($existingWorker.ProcessId)) - not starting another."
}

# --- Open one PowerShell window per service ------------------------------
# Three separate windows (Django, Next.js, Celery worker). -NoExit keeps each
# window open on the shell prompt if its process exits, so an error stays
# visible instead of the window vanishing.
Start-Process powershell -ArgumentList @(
    "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd
) | Out-Null
Write-OK "Backend window opened (Django -> http://localhost:$BackendPort)"

Start-Process powershell -ArgumentList @(
    "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCmd
) | Out-Null
Write-OK "Frontend window opened (Next.js -> http://localhost:$FrontendPort)"

if ($startWorker) {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $workerCmd
    ) | Out-Null
    Write-OK "Celery worker window opened (background tasks)"
}

# --- 4c. Verify the port Next.js ACTUALLY bound --------------------------
# Find-FreePort probes the port immediately BEFORE launch, but `next dev` has its
# own silent fallback: if the port is taken in the meantime - or by a listener the
# probe could not see - it prints "Port X is in use, trying X+1" and binds the
# next one WITHOUT failing. .env.local would then still name the old port, so
# every browser-side call to NEXT_PUBLIC_API_URL would hit a dead origin. That is
# the silent breakage this step exists to prevent, so we read the port back from
# the running process instead of trusting our own pre-check.

# One shared matcher for "a node process belonging to OUR Next.js dev server".
# It must cover every process in the chain, because they are different command
# lines and only the LAST one actually owns the port:
#   npx-cli.js next dev --port N        <- the launcher wrapper
#   node_modules\next\dist\bin\next dev <- the CLI
#   next\dist\server\lib\start-server.js <- the process that BINDS the port
# Missing that third form is why an earlier version of this check reported
# "could not read the port back" even though the server was up. `\next\dist\`
# covers the last two; it is specific enough not to match node processes from
# other projects on this machine.
$NextDevProcPattern = 'next(\.js)?\s+dev|next-server|\\next\\dist\\'

function Get-NextDevPort {
    param([int]$TimeoutSec = 90)

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        # NOTE: do not name the loop variable $pid - that is an automatic
        # PowerShell variable (this shell's own process id).
        $nodePids = @(
            Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -and $_.CommandLine -match $NextDevProcPattern } |
                Select-Object -ExpandProperty ProcessId
        )
        foreach ($procId in $nodePids) {
            $conn = Get-NetTCPConnection -State Listen -OwningProcess $procId -ErrorAction SilentlyContinue |
                Where-Object { $_.LocalPort -ge $FrontendPortPreferred -and $_.LocalPort -lt ($FrontendPortPreferred + 50) } |
                Select-Object -First 1
            if ($conn) { return [int]$conn.LocalPort }
        }
        Start-Sleep -Milliseconds 750
    }
    return $null
}

Write-Host ""
Write-Host "  --- Confirming the frontend port ---" -ForegroundColor White
$actualFrontendPort = Get-NextDevPort -TimeoutSec 90

if (-not $actualFrontendPort) {
    Write-Warn "Could not read the port back from the Next.js process - assuming $FrontendPort."
} elseif ($actualFrontendPort -ne $FrontendPort) {
    # Next.js drifted. NEXT_PUBLIC_* values are read at process start, so
    # rewriting .env.local is not enough on its own - the dev server has to be
    # restarted to pick them up. We do that exactly ONCE, then carry on with
    # whatever port it lands on rather than looping.
    Write-Warn "Next.js bound port $actualFrontendPort, not the $FrontendPort we picked."
    Write-Info "Re-syncing frontend/.env.local and restarting the frontend on $actualFrontendPort..."

    $FrontendPort = $actualFrontendPort
    $frontendUrl  = "http://localhost:$FrontendPort"
    Sync-FrontendEnv -SiteUrl $frontendUrl -ApiBaseUrl $backendUrl | Out-Null

    # Stop only the drifted dev server, then relaunch it pinned to that same port
    # (it is the port Next.js already proved it can bind).
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $NextDevProcPattern } |
        ForEach-Object {
            try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { }
        }
    Start-Sleep -Seconds 2

    Start-Process powershell -ArgumentList @(
        "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", (New-FrontendCmd -Port $FrontendPort)
    ) | Out-Null
    Write-OK "Frontend restarted on $frontendUrl with matching .env.local"
} else {
    Write-OK "Next.js is on port $FrontendPort, as picked"
}

# --- 5. Wait for BOTH servers to answer over HTTP, then open the browser --
# A plain TCP check opens the listening socket as soon as the process binds the
# port - but Next.js binds :3000 long before it has finished compiling the first
# page, so the browser used to open on a "still compiling" screen. We instead do
# a real HTTP request and wait for HTTP 200, which only happens once each server
# is actually serving responses. Both checks share a single 120s deadline.
function Wait-ForHttp {
    param(
        [string]$Url,
        [datetime]$Deadline,
        [string]$Label
    )

    while ((Get-Date) -lt $Deadline) {
        try {
            # -UseBasicParsing keeps this working on machines without IE engine;
            # a non-200 (e.g. 500/404) throws or returns, so we only accept 200.
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 `
                        -MaximumRedirection 0 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { return $true }
        } catch {
            # Connection refused / still compiling / transient 5xx - keep polling.
        }
        Start-Sleep -Milliseconds 750
    }
    return $false
}

Write-Host ""
Write-Host "  --- Waiting for servers (HTTP 200, timeout 120s) ---" -ForegroundColor White

# Single shared 120s budget for both readiness checks. $frontendUrl / $backendUrl
# were resolved from the actual free ports back in section 2b.
$deadline = (Get-Date).AddSeconds(120)
# Django has no root route (GET / -> 404); this endpoint reliably returns 200.
$backendProbeUrl = "$backendUrl/api/locations/choices/"

Write-Info "Waiting for backend (Django) on $backendProbeUrl ..."
$backendReady = Wait-ForHttp -Url $backendProbeUrl -Deadline $deadline -Label "backend"
if ($backendReady) {
    Write-OK "Backend is responding (HTTP 200)"
} else {
    Write-Err "Backend did not return HTTP 200 within 120s."
}

Write-Info "Waiting for frontend (Next.js) on $frontendUrl ..."
$frontendReady = Wait-ForHttp -Url $frontendUrl -Deadline $deadline -Label "frontend"
if ($frontendReady) {
    Write-OK "Frontend is responding (HTTP 200)"
} else {
    Write-Err "Frontend did not return HTTP 200 within 120s."
}

Write-Host ""
if ($backendReady -and $frontendReady) {
    Write-Host "  [OK]   All ready! Opening browser..." -ForegroundColor Green
    Start-Process $frontendUrl | Out-Null
    Write-OK "Opened browser at $frontendUrl"
} else {
    Write-Err "Timed out after 120s - not opening the browser automatically."
    if (-not $backendReady)  { Write-Warn "Backend  ($backendProbeUrl) never answered. Check the Django window for errors." }
    if (-not $frontendReady) { Write-Warn "Frontend ($frontendUrl) never answered. Check the Next.js window - it may still be compiling." }
    Write-Warn "Once the windows look ready, open $frontendUrl manually in your browser."
}

# --- 5b. Confirm the Celery worker came up -------------------------------
# The worker has no HTTP endpoint, so instead of HTTP polling we ask Celery's
# control API to ping live workers (returns an empty list until one answers).
# This is a short, bounded, best-effort check: a failure here never blocks
# startup - the worker window is already open and will keep trying on its own.
Write-Host ""
Write-Host "  --- Waiting for Celery worker (ping, timeout 30s) ---" -ForegroundColor White
$pingPy = "import sys; from config.celery import app; " +
          "r = app.control.ping(timeout=2); " +
          "sys.exit(0 if r else 1)"
$workerReady = $false
$pythonExe = Join-Path $venvDir "Scripts\python.exe"
$workerDeadline = (Get-Date).AddSeconds(30)
if (Test-Path $pythonExe) {
    Push-Location $BackendDir
    try {
        while ((Get-Date) -lt $workerDeadline) {
            & $pythonExe -c $pingPy 2>$null
            if ($LASTEXITCODE -eq 0) { $workerReady = $true; break }
            Start-Sleep -Milliseconds 1000
        }
    } finally {
        Pop-Location
    }
    if ($workerReady) {
        Write-OK "Celery worker is up (responded to ping)"
    } else {
        Write-Warn "Celery worker did not answer a ping within 30s - check its window."
        Write-Warn "Background tasks (e.g. Telegram notifications) will not run until it is ready."
    }
} else {
    # Fallback: no python.exe to ping with - just pause briefly so the window
    # has a moment to appear, matching the spirit of the readiness checks.
    Start-Sleep -Seconds 3
    Write-Warn "Could not verify the Celery worker (no venv python.exe) - assuming it is starting."
}

# --- 6. Summary ----------------------------------------------------------
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "   Centreal is starting up" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "   Frontend : $frontendUrl" -ForegroundColor Yellow
Write-Host "   Backend  : $backendUrl" -ForegroundColor Yellow
Write-Host "   API      : $backendUrl/api" -ForegroundColor Yellow
Write-Host "   Admin    : $backendUrl/admin" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor DarkGray
if ($BackendPort -ne $BackendPortPreferred -or $FrontendPort -ne $FrontendPortPreferred) {
    Write-Host "   (Ports auto-selected: preferred ${FrontendPortPreferred}/${BackendPortPreferred} were busy.)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "   Three PowerShell windows were opened (backend + frontend + Celery worker)." -ForegroundColor DarkGray
Write-Host "   To stop everything: scripts\stop_local.ps1" -ForegroundColor DarkGray
Write-Host ""
