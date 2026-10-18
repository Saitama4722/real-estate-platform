# Pull the newest production DB dump to this computer (off-site copy).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pull_db_backup.ps1
#
# Copies /root/backups/real_estate_db-YYYY-MM-DD.dump (made daily by
# deploy/db-backup.sh) into P:\pCloud\work\Centreal_db\ — OUTSIDE the repo on
# purpose: the dump holds password hashes and client contacts.
#
# ⚠ SSH hygiene (2026-10-18): exactly ONE connection attempt per step, with
# BatchMode=yes (never a password prompt) and ConnectTimeout=10. NO retry
# loops: repeated failed SSH attempts are what fail2ban counts. The server's
# sshd jail bans only port 22, so even a ban would not block the website.
#
# Not scheduled yet: run by hand, or add a weekly Task Scheduler entry later.

$ErrorActionPreference = "Stop"
$Server  = "root@217.114.1.193"
$Dest    = "P:\pCloud\work\Centreal_db"
$Keep    = 8
$SshOpts = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=10")
$Log     = Join-Path $Dest "pull.log"

function Write-Log([string]$msg) {
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Output $line
    Add-Content -Path $Log -Value $line -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

# 1. Name and size of the newest remote dump (one ssh call).
$info = & ssh @SshOpts $Server "f=`$(ls -1 /root/backups/real_estate_db-*.dump 2>/dev/null | sort | tail -1); [ -n `"`$f`" ] && echo `"`$f `$(stat -c %s `"`$f`")`""
if ($LASTEXITCODE -ne 0 -or -not $info) {
    Write-Log "FAIL: could not list remote dumps (ssh exit $LASTEXITCODE). Not retrying."
    exit 1
}
$remotePath, $remoteSize = ($info.Trim() -split " ", 2)
$name  = Split-Path $remotePath -Leaf
$local = Join-Path $Dest $name

if ((Test-Path $local) -and ((Get-Item $local).Length -eq [int64]$remoteSize)) {
    Write-Log "SKIP: $name already here ($remoteSize bytes)"
} else {
    # 2. Copy it (one scp call), then check the size.
    & scp @SshOpts "${Server}:$remotePath" "$local.partial"
    if ($LASTEXITCODE -ne 0) {
        Write-Log "FAIL: scp exit $LASTEXITCODE. Not retrying."
        Remove-Item -Force -ErrorAction SilentlyContinue "$local.partial"
        exit 1
    }
    $got = (Get-Item "$local.partial").Length
    if ($got -ne [int64]$remoteSize) {
        Write-Log "FAIL: size mismatch for $name (remote $remoteSize, local $got)."
        Remove-Item -Force "$local.partial"
        exit 1
    }
    Move-Item -Force "$local.partial" $local
    Write-Log "OK: $name $got bytes"
}

# 3. Keep the newest $Keep local dumps (exact name pattern only).
Get-ChildItem -Path $Dest -File |
    Where-Object { $_.Name -match '^real_estate_db-\d{4}-\d{2}-\d{2}\.dump$' } |
    Sort-Object Name -Descending |
    Select-Object -Skip $Keep |
    ForEach-Object { Remove-Item -Force $_.FullName; Write-Log "ROTATE: removed $($_.Name)" }
