#Requires -Version 5.1
# ============================================================================
#  Centreal - Native local development launcher (no Docker, no Railway)
#  ------------------------------------------------------------------------
#  This project is LOCAL-ONLY. There is deliberately no Railway logic here.
#
#  FIXED PORTS - the launcher never "walks" to another port:
#      backend  (Django)  -> 127.0.0.1:8001
#      frontend (Next.js) -> localhost:3001
#
#  Why fixed, and why 8001/3001 specifically:
#    * Port 8000 is permanently held on this machine by an unrelated
#      third-party process ("Manager.exe").
#    * Port 3000 is permanently held by an unrelated third-party java.exe -
#      the VS Code extension ibm.db2forzosdeveloperextension, which launches
#      com.ibm.db2.server.DssLauncher 3000. It comes and goes with VS Code.
#    * The previous launcher PROBED a free port, released it, and only launched
#      seconds later. Whenever VS Code had not yet claimed 3000 the probe said
#      "free", the launcher pinned `next dev --port 3000`, and java won the race
#      in between -> Next.js 15 exits with EADDRINUSE (it does NOT fall back to
#      another port when the port is given explicitly). The same port walking
#      could silently move Django to 8002 while the frontend kept calling 8001
#      -> ECONNREFUSED on 127.0.0.1:8001. Pinning the ports and refusing to
#      start on a busy one removes both classes of failure.
#
#  Startup sequence:
#    1. Windows services (PostgreSQL, Memurai)
#    2. Backend virtualenv
#    3. Port preflight WITH OWNER IDENTIFICATION - a stale dev server of ours is
#       terminated; anything else aborts that one service. Never a blind kill.
#    4. frontend/.env.local re-synced to the fixed ports
#    5. The "Centreal Backend" window
#    6. Wait for the backend to answer
#    7. THEN the "Centreal Celery" and "Centreal Frontend" windows, then wait
#       for the frontend, then the browser
#
#  ⭐ The frontend and Celery are started only AFTER the backend answers. That
#  is deliberate and measured, not tidiness: started together they fight over
#  this pCloud virtual drive and Django's autoreloader re-execs instead of
#  finishing startup. See the note above the readiness section.
#
#  Every window is -NoExit, so a traceback stays on screen instead of the
#  window vanishing - an invisible Django failure is what surfaces downstream
#  as ECONNREFUSED in the frontend and sends you debugging the wrong service.
#
#  ⭐ READ THE FIRST LINE OF THE "Centreal Backend" WINDOW. Django now prints
#  which database it resolved, e.g.
#      [Centreal] DB  NAME=real_estate_db  USER=postgres  HOST=localhost:5432
#                     (from CENTREAL_DATABASE_URL)
#  and a wall of "!" if the name is not the expected local one.
#
#  Why: this machine has a persistent User-level Windows DATABASE_URL belonging
#  to an unrelated tool, and load_dotenv() never overrides an already-present
#  variable - so backend/.env silently lost and the site talked to the wrong
#  database while looking merely empty. backend/.env therefore sets
#  CENTREAL_DATABASE_URL, which the backend reads FIRST and which cannot
#  collide. These windows inherit this shell's environment, so an ambient
#  variable reaches them; the project-specific name is what makes that harmless.
# ============================================================================

$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$RootDir     = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

# --- Fixed configuration -------------------------------------------------
$BackendHost  = "127.0.0.1"
$BackendPort  = 8001
$FrontendPort = 3001
$RedisPort    = 6379

$BackendUrl      = "http://${BackendHost}:${BackendPort}"
$FrontendUrl     = "http://localhost:${FrontendPort}"

# Any HTTP status proves Django is listening - we do NOT require 200, because a
# listening server returning 500 is still "up" and must not be misreported as
# "the backend did not start".
$BackendProbeUrl = "$BackendUrl/api/properties/"

# Each service gets its OWN budget - the previous launcher shared one 120s
# deadline between them, so a slow backend left the frontend check no time at all
# and reported a failure that had not happened.
#
# Budgets set from MEASUREMENTS on this machine, not from guesses:
#   * Django alone, cold, uncontended: bound its socket at 25.1s and served its
#     first HTTP 200 at 25.5s.
#   * Django cold WHILE Next.js was cold-compiling on the same pCloud drive:
#     exceeded 90s. The two services contend for a slow virtual drive, and they
#     are started together, so the backend budget has to cover the contended
#     case, not the quiet one.
#   * Next.js: ~13-17s warm, 54.9s for a genuinely cold first render.
# These ceilings only ever matter when something is wrong, and a process that has
# actually DIED is now detected directly (see the liveness check below) instead
# of by waiting out the clock - so being generous here costs nothing real.
$BackendReadyTimeoutSec  = 180
$FrontendReadyTimeoutSec = 300

# --- Console helpers -----------------------------------------------------
function Write-OK   ($m) { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Write-Info ($m) { Write-Host "  [..]   $m" -ForegroundColor Cyan }
function Write-Warn ($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Err  ($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }
function Write-Step ($m) {
    Write-Host ""
    Write-Host "  === $m ===" -ForegroundColor White
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "   Centreal - Native local development" -ForegroundColor Cyan
Write-Host "   backend 127.0.0.1:$BackendPort   frontend localhost:$FrontendPort" -ForegroundColor DarkGray
Write-Host "  ============================================" -ForegroundColor DarkGray

# ============================================================================
#  1. Windows services
# ============================================================================
Write-Step "1/7 Windows services"

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
        Write-Warn "Run this launcher from an elevated (Administrator) PowerShell to start services."
    }
}

Ensure-ServiceRunning -Name "postgresql-x64-18" -Label "PostgreSQL 18"

$memuraiSvc = Get-Service -Name "Memurai" -ErrorAction SilentlyContinue
if (-not $memuraiSvc) {
    $memuraiSvc = Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "*memurai*" -or $_.DisplayName -like "*Memurai*" } |
        Select-Object -First 1
}
if ($memuraiSvc) {
    Ensure-ServiceRunning -Name $memuraiSvc.Name -Label "Memurai (Redis)"
} else {
    Write-Warn "Memurai service not found. Celery will be skipped if port $RedisPort is unreachable."
}

# ============================================================================
#  2. Backend virtual environment
# ============================================================================
Write-Step "2/7 Backend virtual environment"

$venvCandidates = @(
    (Join-Path $BackendDir ".venv"),
    (Join-Path $BackendDir "venv")
)
$venvDir = $null
foreach ($c in $venvCandidates) {
    if (Test-Path (Join-Path $c "Scripts\Activate.ps1")) { $venvDir = $c; break }
}
if (-not $venvDir) {
    Write-Err "No virtual environment found in backend/ (.venv or venv)."
    Write-Warn "Create it once with:"
    Write-Host "      cd backend; python -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt" -ForegroundColor DarkGray
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}
$venvActivate = Join-Path $venvDir "Scripts\Activate.ps1"
$venvPython   = Join-Path $venvDir "Scripts\python.exe"
Write-OK "Using virtual environment: $venvDir"

# ============================================================================
#  3. Port preflight - identify the owner, never blind-kill by port
# ============================================================================
Write-Step "3/7 Port preflight"

# Every listener on $Port, with the owning process's name and command line.
function Get-PortOwners {
    param([int]$Port)

    $owners = @()
    $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if (-not $conns -or $conns.Count -eq 0) { return $owners }

    $procIds = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($procId in $procIds) {
        $p = $null
        try {
            $p = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
        } catch { }
        # Built up in plain variables first: `if` as a hashtable VALUE is a
        # PowerShell 7 expression and a parse error in Windows PowerShell 5.1,
        # which this launcher still has to run under as a fallback.
        $ownerName = "(unknown)"
        $ownerPath = $null
        $ownerCmd  = $null
        if ($p) {
            if ($p.Name) { $ownerName = $p.Name }
            $ownerPath = $p.ExecutablePath
            $ownerCmd  = $p.CommandLine
        }
        $owners += [pscustomobject]@{
            ProcessId      = [int]$procId
            Name           = $ownerName
            ExecutablePath = $ownerPath
            CommandLine    = $ownerCmd
        }
    }
    return $owners
}

# Does this process - or one of its ancestors - belong to THIS repository?
# The parent walk is load-bearing: Django's autoreloader re-execs itself through
# the SYSTEM python, and that child's command line is a bare
# "manage.py runserver 8001" with no path in it. Only its parent names the repo.
function Test-BelongsToProject {
    param([int]$ProcessId, [int]$MaxDepth = 5)

    $needle    = $RootDir.ToLowerInvariant()
    $currentId = $ProcessId
    for ($depth = 0; $depth -lt $MaxDepth -and $currentId -gt 0; $depth++) {
        $p = $null
        try {
            $p = Get-CimInstance Win32_Process -Filter "ProcessId = $currentId" -ErrorAction SilentlyContinue
        } catch { }
        if (-not $p) { return $false }

        $haystack = "$($p.CommandLine) $($p.ExecutablePath)".ToLowerInvariant()
        if ($haystack.Contains($needle)) { return $true }
        $currentId = [int]$p.ParentProcessId
    }
    return $false
}

# A stale dev server of OURS: the right interpreter, the right command shape,
# and traceable to this repository. Anything else is somebody else's process
# and is never touched.
function Test-IsOurDevServer {
    param([pscustomobject]$Owner, [string]$Kind)

    if (-not $Owner.CommandLine) { return $false }
    $name = $Owner.Name.ToLowerInvariant()
    $cl   = $Owner.CommandLine

    $shapeOk = $false
    if ($Kind -eq 'backend') {
        $shapeOk = ($name -eq 'python.exe' -or $name -eq 'pythonw.exe') -and
                   ($cl -match 'manage\.py') -and ($cl -match 'runserver')
    } elseif ($Kind -eq 'frontend') {
        $shapeOk = ($name -eq 'node.exe') -and
                   (($cl -match 'next(\.js)?\s+dev') -or ($cl -match 'next-server') -or ($cl -match '\\next\\dist\\'))
    }
    if (-not $shapeOk) { return $false }

    return (Test-BelongsToProject -ProcessId $Owner.ProcessId)
}

# Returns $true when the port is clear to use, $false when this service must be
# skipped. Never terminates a process it has not positively identified as ours.
function Resolve-PortForService {
    param(
        [int]$Port,
        [string]$Kind,
        [string]$Label,
        [string]$Hint
    )

    $owners = Get-PortOwners -Port $Port
    if (-not $owners -or $owners.Count -eq 0) {
        Write-OK "Port $Port is free - $Label can start"
        return $true
    }

    Write-Info "Port $Port is already in use. Identifying the owner..."
    foreach ($o in $owners) {
        Write-Host "         PID $($o.ProcessId)  $($o.Name)" -ForegroundColor Gray
        if ($o.ExecutablePath) { Write-Host "         path: $($o.ExecutablePath)" -ForegroundColor DarkGray }
        if ($o.CommandLine)    { Write-Host "         cmd : $($o.CommandLine)"    -ForegroundColor DarkGray }
    }

    $foreign = @($owners | Where-Object { -not (Test-IsOurDevServer -Owner $_ -Kind $Kind) })
    if ($foreign.Count -gt 0) {
        $names = ($foreign | ForEach-Object { "$($_.Name) (PID $($_.ProcessId))" }) -join ", "
        Write-Host ""
        Write-Err "REFUSING TO TOUCH PORT $Port - it is owned by: $names"
        Write-Err "That is NOT a Centreal dev server, so it will not be terminated."
        Write-Warn "$Label will NOT be started."
        if ($Hint) { Write-Warn $Hint }
        Write-Host ""
        return $false
    }

    # Everything listening on this port is a stale dev server of ours.
    foreach ($o in $owners) {
        Write-Warn "Stale Centreal $Kind dev server on port $Port (PID $($o.ProcessId)) - terminating it."
        try {
            Stop-Process -Id $o.ProcessId -Force -ErrorAction Stop
        } catch {
            Write-Warn "Could not stop PID $($o.ProcessId): $($_.Exception.Message)"
        }
    }

    # Wait for the socket to actually be released before launching onto it.
    $releaseDeadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $releaseDeadline) {
        $still = Get-PortOwners -Port $Port
        if (-not $still -or $still.Count -eq 0) {
            Write-OK "Port $Port released - $Label can start"
            return $true
        }
        Start-Sleep -Milliseconds 400
    }

    Write-Err "Port $Port is still held after terminating the stale process."
    Write-Warn "$Label will NOT be started. Run scripts\stop_local.ps1 and try again."
    return $false
}

$backendHint  = "Port $BackendPort is the only backend port this project uses (8000 is permanently taken by 'Manager'). Close whatever owns $BackendPort, then re-run."
$frontendHint = "Port $FrontendPort is the only frontend port this project uses (3000 is permanently taken by the VS Code Db2 java process). Close whatever owns $FrontendPort, then re-run."

$backendClear  = Resolve-PortForService -Port $BackendPort  -Kind 'backend'  -Label "Backend (Django)"  -Hint $backendHint
$frontendClear = Resolve-PortForService -Port $FrontendPort -Kind 'frontend' -Label "Frontend (Next.js)" -Hint $frontendHint

# Memurai reachability decides only whether Celery is worth starting. A missing
# broker never aborts the launcher - the site works fine without background
# tasks, it just will not send e.g. Telegram lead notifications.
function Test-TcpReachable {
    param([string]$TargetHost = "127.0.0.1", [int]$Port, [int]$TimeoutMs = 2000)

    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async  = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        if ($client) { try { $client.Close() } catch { } }
    }
}

$redisUp = Test-TcpReachable -Port $RedisPort
if ($redisUp) {
    Write-OK "Memurai (Redis) is reachable on 127.0.0.1:$RedisPort"
} else {
    Write-Warn "Memurai (Redis) is NOT reachable on 127.0.0.1:$RedisPort - the Celery worker will be skipped."
    Write-Warn "The site still works; only background tasks (e.g. Telegram notifications) will not run."
}

# ============================================================================
#  4. Sync frontend/.env.local to the fixed ports
# ============================================================================
Write-Step "4/7 frontend/.env.local"

# Next.js reads .env.local at process start, so these must be right BEFORE the
# dev server launches. Only the four URL lines are touched; a key that is
# missing entirely is appended rather than skipped.
$envLocalPath = Join-Path $FrontendDir ".env.local"

# Write UTF-8 without a BOM, in place.
#
# ⚠ Do NOT "simplify" this to [System.IO.File]::WriteAllText. That opens the
# file with CREATE_ALWAYS, and Windows denies CREATE_ALWAYS on a file carrying
# the Hidden attribute - which .env.local does here, because dot-files on this
# drive are created hidden. It fails with a bare "Access to the path ... is
# denied" that looks like a pCloud lock and is not one. FileMode::OpenOrCreate
# maps to OPEN_ALWAYS, which is hidden-safe; SetLength(0) does the truncation.
# The retry loop is for genuine pCloud locking, which is a separate hazard.
function Write-TextFileNoBom {
    param([string]$Path, [string]$Text, [int]$Attempts = 3)

    $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($Text)
    for ($i = 1; $i -le $Attempts; $i++) {
        $stream = $null
        try {
            $stream = [System.IO.File]::Open(
                $Path,
                [System.IO.FileMode]::OpenOrCreate,
                [System.IO.FileAccess]::Write,
                [System.IO.FileShare]::Read)
            $stream.SetLength(0)
            $stream.Write($bytes, 0, $bytes.Length)
            return $true
        } catch {
            if ($i -eq $Attempts) { throw }
            Start-Sleep -Milliseconds 400
        } finally {
            if ($stream) { try { $stream.Dispose() } catch { } }
        }
    }
    return $false
}

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
        # -Encoding UTF8 on BOTH sides is load-bearing. Windows PowerShell 5.1
        # reads with the ANSI code page by default, so an earlier read-then-write
        # cycle re-encoded this file's Cyrillic comments into mojibake.
        $envLines = @(Get-Content -LiteralPath $envLocalPath -Encoding UTF8)
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
        foreach ($key in $wanted.Keys) {
            if (-not $seen.ContainsKey($key)) {
                $envLines += "$key=$($wanted[$key])"
                Write-Info "Added missing $key to frontend/.env.local"
            }
        }
        # UTF-8 WITHOUT a BOM: 5.1's Set-Content -Encoding UTF8 emits a BOM,
        # which dotenv-style parsers can trip over on the first line.
        Write-TextFileNoBom -Path $envLocalPath -Text (($envLines -join "`r`n") + "`r`n") | Out-Null
        Write-OK "Synced frontend/.env.local (site -> $SiteUrl, backend -> $ApiBaseUrl)"
        return $true
    } catch {
        Write-Warn "Could not update frontend/.env.local: $($_.Exception.Message)"
        Write-Warn "The site may name a stale port - check NEXT_PUBLIC_SITE_URL / BACKEND_URL."
        Write-Warn "Fix by hand: NEXT_PUBLIC_SITE_URL=$SiteUrl, NEXT_PUBLIC_API_URL=$SiteUrl/api, BACKEND_URL=$ApiBaseUrl"
        return $false
    }
}

Sync-FrontendEnv -SiteUrl $FrontendUrl -ApiBaseUrl $BackendUrl | Out-Null

# ============================================================================
#  5. Launch one window per service
# ============================================================================
Write-Step "5/7 Starting the backend"

# Each payload is a single semicolon-separated line handed to
# `powershell -NoExit -Command`. -NoExit is what keeps the window on screen
# after the process exits: without it a Django traceback flashes past and the
# only symptom left is ECONNREFUSED in the frontend window.
$exitBanner = "Write-Host ''; " +
              "Write-Host '  ==================================================================' -ForegroundColor Red; " +
              "Write-Host '   The process above EXITED. Scroll up for the traceback.' -ForegroundColor Red; " +
              "Write-Host '   This window stays open on purpose - close it when you are done.' -ForegroundColor Red; " +
              "Write-Host '  ==================================================================' -ForegroundColor Red"

function Start-ServiceWindow {
    param([string]$Payload)
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Payload
    ) | Out-Null
}

# --- Backend -------------------------------------------------------------
# PYTHONUTF8=1 so Cyrillic in Django's output cannot raise UnicodeEncodeError in
# a legacy-code-page console and take the server down with it.
$backendCmd = @(
    "`$host.UI.RawUI.WindowTitle = 'Centreal Backend'"
    "Set-Location -LiteralPath '$BackendDir'"
    "& '$venvActivate'"
    "`$env:PYTHONUTF8 = '1'"
    "Write-Host ('  python: ' + (Get-Command python).Source) -ForegroundColor DarkGray"
    "python manage.py runserver $BackendPort"
    $exitBanner
) -join "; "

if ($backendClear) {
    Start-ServiceWindow -Payload $backendCmd
    Write-OK "Backend window opened  ('Centreal Backend'  -> $BackendUrl)"
} else {
    Write-Err "Backend NOT started - port $BackendPort is owned by another process (see above)."
}

# --- Frontend ------------------------------------------------------------
# PORT is the only reliable way to pin the port here:
#   * `npm run dev -- -p 3001` loses the flag under PowerShell, and Next.js then
#     treats "3001" as a directory argument;
#   * an explicit --port makes Next.js 15 exit with EADDRINUSE rather than fall
#     back, which is exactly the crash this rewrite removes.
# NODE_ENV: these windows INHERIT the launching shell's environment, and this
# machine carries NODE_ENV=production at the user level. `next dev` under
# NODE_ENV=production does not wire up the CSS/PostCSS loader chain and every
# page 500s with "Module parse failed: Unexpected character '@'". The guard
# below only corrects a non-development value; a shell that is already
# development is left untouched.
# NOTE: nothing here ever deletes .next - on the pCloud drive a cold rebuild is
# destructive (file locks, EPERM) and a warm cache is what keeps dev stable.
$frontendCmd = @(
    "`$host.UI.RawUI.WindowTitle = 'Centreal Frontend'"
    "Set-Location -LiteralPath '$FrontendDir'"
    "if (`$env:NODE_ENV -ne 'development') { Write-Host ('  NODE_ENV was [' + `$env:NODE_ENV + '] - forcing development for next dev') -ForegroundColor Yellow; `$env:NODE_ENV = 'development' }"
    "`$env:PORT = '$FrontendPort'"
    "Write-Host '  PORT=$FrontendPort (set via environment, no -p flag)' -ForegroundColor DarkGray"
    "npm run dev"
    $exitBanner
) -join "; "

# ⚠ The frontend is NOT started here - it is started AFTER the backend answers.
# See the "why the frontend waits for the backend" note above the readiness
# section; starting them together is what made Django's autoreloader thrash.

# --- Celery worker -------------------------------------------------------
# Duplicate guard scoped to python.exe ON PURPOSE. A wider scan also matched the
# launcher's own -NoExit window (its command line contains this same text), so a
# dead worker sitting at a prompt looked like a live worker and no replacement
# was ever started.
$existingWorker = $null
try {
    $existingWorker = Get-CimInstance Win32_Process `
            -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match 'celery' -and $_.CommandLine -match '\bworker\b' } |
        Select-Object -First 1
} catch {
    $existingWorker = $null
}

$workerCmd = @(
    "`$host.UI.RawUI.WindowTitle = 'Centreal Celery'"
    "Set-Location -LiteralPath '$BackendDir'"
    "`$env:PYTHONUTF8 = '1'"
    "& '$venvPython' -m celery -A config.celery worker -l info -P solo"
    $exitBanner
) -join "; "

# Also deferred until the backend is up - a Celery worker boots the whole Django
# app, so starting it alongside runserver just adds more disk contention to the
# one thing we are waiting on.
$workerStarted = $false

# ============================================================================
#  6-7. Readiness gating - backend first, then frontend
# ============================================================================

# ANY HTTP status means the server is listening and answering. A 404 or a 500
# proves the socket is alive just as well as a 200 does; requiring 200 is how the
# previous launcher reported "the backend did not come up" about a Django that
# was up and returning an error page.
#
# IsAlive is what turns a dead service into an instant, accurate message instead
# of a full-length wait. If `next dev` exits on EADDRINUSE, or Django dies on a
# startup traceback, there is nothing left to poll - waiting out the budget just
# delays the truth. GraceSec covers the gap between Start-Process returning and
# the child actually appearing in the process table.
#
# ⚠ THE PER-ATTEMPT TIMEOUT IS THE WHOLE GAME - do not put a small fixed number
# back here. A Next.js dev server accepts the connection instantly and then holds
# the request open while it compiles, and ABORTING that request makes it restart
# the render. So a loop of short requests against a page that needs ~55s to
# compile never succeeds: it aborts, Next restarts, it aborts again, forever.
# `[measured]` — a 240s budget made of 30s attempts failed completely, and a
# single patient request immediately afterwards returned HTTP 200 in 54.9s.
# Each attempt therefore gets ALL of the remaining budget. A process that dies
# closes its socket, so a patient request still fails fast in the case that
# matters, and the liveness check below then fires.
function Wait-ForHttpResponse {
    param(
        [string]$Url,
        [int]$TimeoutSec,
        [scriptblock]$IsAlive = $null,
        [int]$GraceSec = 20
    )

    # Invoke-WebRequest renders a progress bar by default, which is pure cost
    # here and measurably slower (1.8s vs 0.96s on the same warm response).
    $previousProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'

    $start     = Get-Date
    $deadline  = $start.AddSeconds($TimeoutSec)
    $lastError = "no response"
    $tick      = 0
    try {
    while ((Get-Date) -lt $deadline) {
        # Give this attempt everything that is left, never a fixed slice.
        $remaining = [int][Math]::Ceiling(($deadline - (Get-Date)).TotalSeconds)
        if ($remaining -lt 5) { $remaining = 5 }
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $remaining `
                        -MaximumRedirection 0 -ErrorAction Stop
            return [pscustomobject]@{ Ready = $true; Status = [int]$resp.StatusCode; Error = ""; Died = $false }
        } catch {
            $response = $null
            try { $response = $_.Exception.Response } catch { }
            if ($response) {
                $code = 0
                try { $code = [int]$response.StatusCode } catch { $code = 0 }
                # A real HTTP status came back - the server IS listening.
                if ($code -gt 0) {
                    return [pscustomobject]@{ Ready = $true; Status = $code; Error = ""; Died = $false }
                }
            }
            $lastError = $_.Exception.Message
        }

        # Liveness is checked every ~4th pass so the CIM query stays cheap.
        $tick++
        if ($IsAlive -and ($tick % 4 -eq 0) -and
            ((Get-Date) -gt $start.AddSeconds($GraceSec))) {
            if (-not (& $IsAlive)) {
                return [pscustomobject]@{
                    Ready  = $false
                    Status = 0
                    Error  = "the process is no longer running - it exited during startup"
                    Died   = $true
                }
            }
        }

        Start-Sleep -Milliseconds 750
    }
    return [pscustomobject]@{ Ready = $false; Status = 0; Error = $lastError; Died = $false }
    } finally {
        $ProgressPreference = $previousProgress
    }
}

# Liveness probes: is a process of the right shape, belonging to this repo,
# still running? Reuses the same classifier the port preflight uses.
$BackendIsAlive = {
    $procs = @(Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match 'manage\.py' -and $_.CommandLine -match 'runserver' })
    foreach ($p in $procs) {
        if (Test-BelongsToProject -ProcessId $p.ProcessId) { return $true }
    }
    return $false
}
$FrontendIsAlive = {
    $procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and (($_.CommandLine -match 'next(\.js)?\s+dev') -or ($_.CommandLine -match 'next-server') -or ($_.CommandLine -match '\\next\\dist\\') -or ($_.CommandLine -match 'run\s+dev')) })
    foreach ($p in $procs) {
        if (Test-BelongsToProject -ProcessId $p.ProcessId) { return $true }
    }
    return $false
}

Write-Step "6/7 Waiting for the backend (up to ${BackendReadyTimeoutSec}s)"
$backendReady = $false
if ($backendClear) {
    Write-Info "Polling $BackendProbeUrl ..."
    $r = Wait-ForHttpResponse -Url $BackendProbeUrl -TimeoutSec $BackendReadyTimeoutSec -IsAlive $BackendIsAlive
    $backendReady = $r.Ready
    if ($backendReady) {
        Write-OK "Backend is answering (HTTP $($r.Status)) on $BackendUrl"
    } elseif ($r.Died) {
        Write-Err "Backend DIED during startup - Django is no longer running."
        Write-Err "The traceback is in the 'Centreal Backend' window, which was kept open for it."
    } else {
        Write-Err "Backend did not answer within ${BackendReadyTimeoutSec}s: $($r.Error)"
    }
} else {
    Write-Err "Backend was never started (port $BackendPort was taken) - nothing to wait for."
}

# --- Now that the backend answers, start the other two --------------------
#
# ⭐ WHY THE FRONTEND WAITS FOR THE BACKEND — this is not tidiness, it is the
# fix for a measured failure. Started together, Django and `next dev` compete
# for one slow pCloud virtual drive, and Django's AUTORELOADER re-execs under
# that load instead of finishing startup. `[measured]`: Django alone binds in
# 25.1s and answers at 25.5s; Django started alongside a cold Next compile
# returned "connection refused" for a FULL 180s, and the process that finally
# served was spawned 119s after the launcher opened the window — a reload
# storm, not a crash (the liveness probe correctly never fired: Django was
# alive the whole time, just never finishing). Serialising costs ~25s in the
# good case and turns a reproducible failure into a reliable start.
if ($backendReady) {
    Write-Host ""
    if (-not $redisUp) {
        Write-Warn "Celery worker skipped - no Redis/Memurai on 127.0.0.1:$RedisPort."
    } elseif ($existingWorker) {
        Write-Warn "A Celery worker is already running (PID $($existingWorker.ProcessId)) - not starting another."
    } else {
        Start-ServiceWindow -Payload $workerCmd
        $workerStarted = $true
        Write-OK "Celery window opened   ('Centreal Celery')"
    }

    if ($frontendClear) {
        Start-ServiceWindow -Payload $frontendCmd
        Write-OK "Frontend window opened ('Centreal Frontend' -> $FrontendUrl)"
    } else {
        Write-Err "Frontend NOT started - port $FrontendPort is owned by another process (see above)."
    }
}

Write-Step "7/7 Waiting for the frontend (up to ${FrontendReadyTimeoutSec}s)"
$frontendReady = $false
if (-not $backendReady) {
    # Opening the browser now would only show a site whose every server-side
    # fetch fails with ECONNREFUSED - the confusing symptom this launcher exists
    # to prevent. The frontend was deliberately not started either.
    Write-Warn "Frontend was not started because the backend never came up."
} elseif (-not $frontendClear) {
    Write-Err "Frontend was never started (port $FrontendPort was taken) - nothing to wait for."
} else {
    Write-Info "Polling $FrontendUrl ... (a cold Next.js compile on this drive can take 20-40s)"
    $r = Wait-ForHttpResponse -Url $FrontendUrl -TimeoutSec $FrontendReadyTimeoutSec `
             -IsAlive $FrontendIsAlive
    $frontendReady = $r.Ready
    if ($frontendReady) {
        Write-OK "Frontend is answering (HTTP $($r.Status)) on $FrontendUrl"
    } elseif ($r.Died) {
        Write-Err "Frontend DIED during startup - the Next.js dev server is no longer running."
        Write-Err "The error is in the 'Centreal Frontend' window, which was kept open for it."
        Write-Warn "If it says EADDRINUSE, something claimed port $FrontendPort after the preflight."
    } else {
        Write-Err "Frontend did not answer within ${FrontendReadyTimeoutSec}s: $($r.Error)"
        Write-Warn "It may simply still be compiling - check the 'Centreal Frontend' window."
    }
}

# --- Browser -------------------------------------------------------------
Write-Host ""
if ($backendReady -and $frontendReady) {
    Write-Info "Opening the browser at $FrontendUrl ..."
    Start-Process $FrontendUrl | Out-Null
    Write-OK "Browser opened at $FrontendUrl"
} else {
    Write-Err "NOT opening the browser - the stack is not fully up."
    if (-not $backendClear) {
        Write-Warn "Backend  : never started - port $BackendPort belongs to another process."
    } elseif (-not $backendReady) {
        Write-Warn "Backend  : FAILED. Look at the 'Centreal Backend' window - the traceback is in it."
    }
    if (-not $frontendClear) {
        Write-Warn "Frontend : never started - port $FrontendPort belongs to another process."
    } elseif (-not $frontendReady) {
        Write-Warn "Frontend : FAILED. Look at the 'Centreal Frontend' window - the error is in it."
    }
    Write-Warn "When the windows look healthy, open $FrontendUrl manually."
}

# --- Celery readiness (best effort, never blocks) ------------------------
if ($workerStarted) {
    Write-Host ""
    Write-Info "Checking the Celery worker (ping, up to 30s)..."
    $pingPy = "import sys; from config.celery import app; r = app.control.ping(timeout=2); sys.exit(0 if r else 1)"
    $workerReady = $false
    $workerDeadline = (Get-Date).AddSeconds(30)
    Push-Location $BackendDir
    try {
        while ((Get-Date) -lt $workerDeadline) {
            & $venvPython -c $pingPy 2>$null
            if ($LASTEXITCODE -eq 0) { $workerReady = $true; break }
            Start-Sleep -Milliseconds 1000
        }
    } finally {
        Pop-Location
    }
    if ($workerReady) {
        Write-OK "Celery worker answered a ping"
    } else {
        Write-Warn "Celery worker did not answer within 30s - check the 'Centreal Celery' window."
        Write-Warn "Background tasks will not run until it is ready. The site itself is unaffected."
    }
}

# ============================================================================
#  Summary
# ============================================================================
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGray
if ($backendReady -and $frontendReady) {
    Write-Host "   Centreal is UP" -ForegroundColor Green
} else {
    Write-Host "   Centreal did NOT start cleanly" -ForegroundColor Red
}
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "   Frontend : $FrontendUrl" -ForegroundColor Yellow
Write-Host "   Backend  : $BackendUrl" -ForegroundColor Yellow
Write-Host "   API      : $BackendUrl/api" -ForegroundColor Yellow
Write-Host "   Admin    : $BackendUrl/admin" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "   Ports are FIXED: 3001 frontend / 8001 backend." -ForegroundColor DarkGray
Write-Host "   3000 and 8000 are permanently held by other software on this PC." -ForegroundColor DarkGray
Write-Host "   To stop everything: scripts\stop_local.ps1" -ForegroundColor DarkGray
Write-Host ""

if ($backendReady -and $frontendReady) { exit 0 }
exit 1
