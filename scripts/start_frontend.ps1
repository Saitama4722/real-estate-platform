#Requires -Version 5.1
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ================================================================
#  Centreal — Запуск фронтенда
#  Автоматически:
#    - проверяет Node.js/npm
#    - устанавливает зависимости при необходимости
#    - находит свободный порт (3000–3010)
#    - запускает Next.js dev сервер
#    - открывает браузер
#    - пишет лог в logs/frontend/
# ================================================================

$RootDir     = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RootDir "frontend"
$LogsDir     = Join-Path $RootDir "logs\frontend"
$Timestamp   = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile     = Join-Path $LogsDir "frontend_$Timestamp.log"
$LatestLog   = Join-Path $LogsDir "latest.log"

# ----------------------------------------------------------------
# Вспомогательные функции вывода
# ----------------------------------------------------------------
function Log($msg) {
    Add-Content -Path $LogFile -Value $msg -Encoding UTF8
}

function Print-Divider {
    $line = "  =================================================="
    Write-Host $line -ForegroundColor DarkGray
    Log $line
}

function Print-Section($text) {
    Write-Host ""
    $line = "  --- $text ---"
    Write-Host $line -ForegroundColor White
    Log ""
    Log $line
}

function Print-Step($text) {
    $line = "     >> $text"
    Write-Host $line -ForegroundColor Cyan
    Log $line
}

function Print-OK($text) {
    $line = "     [OK] $text"
    Write-Host $line -ForegroundColor Green
    Log $line
}

function Print-Fail($text) {
    $line = "     [!!] $text"
    Write-Host $line -ForegroundColor Red
    Log $line
}

function Print-Info($text) {
    $line = "     $text"
    Write-Host $line -ForegroundColor DarkGray
    Log $line
}

# ----------------------------------------------------------------
# Проверка свободного порта через TCP-сокет
# ----------------------------------------------------------------
function Test-PortFree([int]$p) {
    try {
        $tcp = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback, $p)
        $tcp.Start()
        $tcp.Stop()
        return $true
    } catch {
        return $false
    }
}

# ----------------------------------------------------------------
# Создаём папку для логов
# ----------------------------------------------------------------
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$StartTime = Get-Date -Format "dd.MM.yyyy HH:mm:ss"
Set-Content -Path $LogFile -Value "Centreal Frontend Log — $StartTime`r`n" -Encoding UTF8

# ================================================================
# ШАПКА
# ================================================================
Clear-Host
Write-Host ""
Print-Divider
Write-Host "     Centreal — Запуск фронтенда" -ForegroundColor Cyan
Write-Host "     $StartTime" -ForegroundColor DarkGray
Print-Divider

# ================================================================
# ШАГ 1 — Проверка окружения
# ================================================================
Print-Section "Шаг 1 / Проверка окружения"

try {
    $nodeVer = & node --version 2>&1
    Print-OK "Node.js: $nodeVer"
} catch {
    Print-Fail "Node.js не найден. Установите с https://nodejs.org"
    Log "ОШИБКА: Node.js не найден"
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}

try {
    $npmVer = & npm --version 2>&1
    Print-OK "npm: $npmVer"
} catch {
    Print-Fail "npm не найден"
    Log "ОШИБКА: npm не найден"
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}

# ================================================================
# ШАГ 2 — Папка фронтенда
# ================================================================
Print-Section "Шаг 2 / Проверка папки frontend"

if (-not (Test-Path $FrontendDir)) {
    Print-Fail "Папка не найдена: $FrontendDir"
    Log "ОШИБКА: папка frontend не найдена"
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}
Print-OK "Найдена: $FrontendDir"

# ================================================================
# ШАГ 3 — Зависимости
# ================================================================
Print-Section "Шаг 3 / Проверка зависимостей"

$nodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Print-Step "node_modules не найден — выполняем npm install..."
    Log "Запуск npm install..."
    Push-Location $FrontendDir
    try {
        $installOut = npm install 2>&1
        Log ($installOut | Out-String)
        Print-OK "Зависимости установлены"
    } catch {
        Print-Fail "Ошибка при установке зависимостей: $_"
        Log "ОШИБКА npm install: $_"
        Pop-Location
        Write-Host ""
        Read-Host "  Нажмите Enter для выхода"
        exit 1
    }
    Pop-Location
} else {
    Print-OK "node_modules найден"
}

# ================================================================
# ШАГ 4 — Поиск свободного порта
# ================================================================
Print-Section "Шаг 4 / Поиск свободного порта"

$port    = 3000
$maxPort = 3010

while ($port -le $maxPort) {
    if (Test-PortFree $port) { break }
    Print-Step "Порт $port занят — проверяем $($port + 1)..."
    Log "Порт $port занят"
    $port++
}

if ($port -gt $maxPort) {
    Print-Fail "Нет свободных портов в диапазоне 3000–$maxPort"
    Log "ОШИБКА: нет свободных портов"
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}

Print-OK "Свободный порт: $port"
Log "Выбран порт: $port"

$localUrl = "http://localhost:$port"

# ================================================================
# ШАГ 5 — Запуск
# ================================================================
Print-Section "Шаг 5 / Запуск Next.js dev сервера"

Log "Команда: npx next dev --port $port"
Log "URL: $localUrl"
Log ""
Log "=== Вывод сервера ==="

Write-Host ""
Print-Divider
Write-Host ("     Адрес:  " + $localUrl) -ForegroundColor Yellow
Write-Host ("     Лог:    " + $LogFile)  -ForegroundColor DarkGray
Write-Host  "     Стоп:   Ctrl+C"         -ForegroundColor DarkGray
Print-Divider
Write-Host ""

# Открываем браузер через 3 секунды
$null = Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Seconds 3
    Start-Process $u
} -ArgumentList $localUrl

# Копируем в latest.log до запуска сервера
Copy-Item -Path $LogFile -Destination $LatestLog -Force

# ----------------------------------------------------------------
# Запуск Next.js — вывод идёт и в консоль, и в лог-файл
# ----------------------------------------------------------------
try {
    Push-Location $FrontendDir
    # Invoke Next.js directly; `npm run dev -- --port` is unreliable on Windows
    # PowerShell. $env:PORT is a fallback (Next.js honours PORT too).
    $env:PORT = "$port"
    npx next dev --port $port 2>&1 | Tee-Object -Append -FilePath $LogFile
} finally {
    if ((Get-Location).Path -ne $RootDir) {
        try { Pop-Location } catch {}
    }
    $endTime = Get-Date -Format "dd.MM.yyyy HH:mm:ss"
    $endLine = "`r`n=== Сервер остановлен: $endTime ==="
    Add-Content -Path $LogFile -Value $endLine -Encoding UTF8
    Copy-Item -Path $LogFile -Destination $LatestLog -Force
}

# ================================================================
# Завершение
# ================================================================
Write-Host ""
Write-Host "  Сервер остановлен." -ForegroundColor DarkGray
Write-Host "  Лог сохранён:" -ForegroundColor DarkGray
Write-Host "    $LogFile" -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Нажмите Enter для закрытия"
