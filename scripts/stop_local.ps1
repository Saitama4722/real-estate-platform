#Requires -Version 5.1
# ============================================================================
#  Centreal - Stop native local development servers
#  ------------------------------------------------------------------------
#  Cleanly stops the Django (manage.py runserver), Next.js (next dev), and
#  Celery worker processes. PostgreSQL and Memurai services are LEFT RUNNING.
#  This is process-based (matches command lines), so it works the same whether
#  the services run in separate windows or as split panes in one Windows
#  Terminal. Note: with the wt split-pane layout, stopping the processes leaves
#  the (now-empty) panes / terminal window open - close it manually.
# ============================================================================

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-OK   ($m) { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Write-Info ($m) { Write-Host "  [..]   $m" -ForegroundColor Cyan }
function Write-Warn ($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Stopping Centreal local dev servers..." -ForegroundColor Cyan
Write-Host ""

function Stop-Matching {
    param([string]$ProcName, [scriptblock]$Match, [string]$Label)

    $procs = Get-CimInstance Win32_Process -Filter "Name='$ProcName'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and (& $Match $_.CommandLine) }
    if (-not $procs) {
        Write-Info "No $Label process found."
        return 0
    }
    $n = 0
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Write-OK "Stopped $Label (PID $($p.ProcessId))"
            $n++
        } catch {
            Write-Warn "Could not stop PID $($p.ProcessId): $($_.Exception.Message)"
        }
    }
    return $n
}

$stopped = 0

# Django dev server: python manage.py runserver (plus the autoreload child).
$stopped += Stop-Matching -ProcName "python.exe" -Label "Django backend" -Match {
    param($cl) ($cl -match "manage\.py") -and ($cl -match "runserver")
}

# Next.js dev server: node running 'next dev' / 'next-server', or 'npm run dev'.
$stopped += Stop-Matching -ProcName "node.exe" -Label "Next.js frontend" -Match {
    param($cl)
    ($cl -match "next(\.js)?\s+dev") -or ($cl -match "next-server") -or
    ($cl -match "\\next\\dist\\bin\\next") -or ($cl -match "run\s+dev")
}

# Celery worker: python.exe with 'celery ... worker' in its command line.
$stopped += Stop-Matching -ProcName "python.exe" -Label "Celery worker" -Match {
    param($cl) ($cl -match "celery") -and ($cl -match "\bworker\b")
}

Write-Host ""
if ($stopped -gt 0) {
    Write-OK "Done. Stopped $stopped process(es)."
} else {
    Write-Warn "Nothing to stop (servers may already be down; otherwise close the windows manually)."
}
Write-Host "  PostgreSQL and Memurai services were left running." -ForegroundColor DarkGray
Write-Host ""
