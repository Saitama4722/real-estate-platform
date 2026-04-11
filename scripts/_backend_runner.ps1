#Requires -Version 5.1
param(
    [int]$Port      = 8000,
    [string]$LogFile   = "",
    [string]$PythonExe = "python"
)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir    = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"

$host.UI.RawUI.WindowTitle = "Centreal — Backend :$Port"

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor DarkGray
Write-Host "  Centreal — Django backend" -ForegroundColor Cyan
Write-Host "  Порт:       $Port" -ForegroundColor DarkGray
Write-Host "  Директория: $BackendDir" -ForegroundColor DarkGray
if ($LogFile) {
    Write-Host "  Лог:        $LogFile" -ForegroundColor DarkGray
}
Write-Host "  Стоп:       Ctrl+C" -ForegroundColor DarkGray
Write-Host "  ==================================================" -ForegroundColor DarkGray
Write-Host ""

Set-Location $BackendDir
$env:DJANGO_SETTINGS_MODULE = "config.settings"

if ($LogFile) {
    & $PythonExe manage.py runserver "0.0.0.0:$Port" 2>&1 | Tee-Object -Append -FilePath $LogFile
} else {
    & $PythonExe manage.py runserver "0.0.0.0:$Port"
}

$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "  ==================================================" -ForegroundColor DarkGray
if ($exitCode -eq 0 -or $null -eq $exitCode) {
    Write-Host "  Backend остановлен (код выхода: $exitCode)" -ForegroundColor DarkGray
} else {
    Write-Host "  [!!] Backend завершился с ошибкой (код выхода: $exitCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Возможные причины:" -ForegroundColor Yellow
    Write-Host "    - PostgreSQL недоступен или не запущен" -ForegroundColor Yellow
    Write-Host "    - Ошибка подключения psycopg2 к базе данных" -ForegroundColor Yellow
    Write-Host "    - Конфликт версий библиотек (libpq, OpenSSL)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Что проверить:" -ForegroundColor White
    Write-Host "    1. Запущен ли Docker?  docker compose up db -d" -ForegroundColor DarkGray
    Write-Host "    2. Доступна ли БД?     docker exec real-estate-db psql -U postgres -c ""SELECT 1""" -ForegroundColor DarkGray
    Write-Host "    3. Создайте venv и переустановите зависимости:" -ForegroundColor DarkGray
    Write-Host "         cd backend" -ForegroundColor DarkGray
    Write-Host "         python -m venv venv" -ForegroundColor DarkGray
    Write-Host "         venv\Scripts\activate" -ForegroundColor DarkGray
    Write-Host "         pip install -r requirements.txt" -ForegroundColor DarkGray
    if ($LogFile) {
        Write-Host ""
        Write-Host "  Полный лог выше и в файле:" -ForegroundColor DarkGray
        Write-Host "    $LogFile" -ForegroundColor Cyan
    }
}
Write-Host "  ==================================================" -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Нажмите Enter для закрытия"
