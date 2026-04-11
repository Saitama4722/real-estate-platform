#Requires -Version 5.1
param(
    [int]$Port       = 3000,
    [string]$LogFile = "",
    [string]$ApiUrl  = "http://localhost:8000/api"
)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir     = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RootDir "frontend"

$host.UI.RawUI.WindowTitle = "Centreal — Frontend :$Port"

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor DarkGray
Write-Host "  Centreal — Next.js frontend" -ForegroundColor Cyan
Write-Host "  Порт:    $Port" -ForegroundColor DarkGray
Write-Host "  API URL: $ApiUrl" -ForegroundColor DarkGray
if ($LogFile) {
    Write-Host "  Лог:     $LogFile" -ForegroundColor DarkGray
}
Write-Host "  Стоп:    Ctrl+C" -ForegroundColor DarkGray
Write-Host "  ==================================================" -ForegroundColor DarkGray
Write-Host ""

Set-Location $FrontendDir
$env:NEXT_PUBLIC_API_URL = $ApiUrl
$backendRoot = ($ApiUrl -replace "/api/?$", "").TrimEnd("/")
if ($backendRoot) {
    $env:BACKEND_URL = $backendRoot
}

if ($LogFile) {
    try {
        npm run dev -- --port $Port 2>&1 | Tee-Object -Append -FilePath $LogFile
    } catch {
        Write-Host ""
        Write-Host "  [!!] Ошибка запуска frontend: $_" -ForegroundColor Red
        if ($LogFile) {
            Add-Content -Path $LogFile -Value "ОШИБКА: $_" -Encoding UTF8 -ErrorAction SilentlyContinue
        }
    }
} else {
    npm run dev -- --port $Port
}

Write-Host ""
Read-Host "  Frontend остановлен. Нажмите Enter для закрытия"
