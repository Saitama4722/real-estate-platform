#Requires -Version 5.1
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ================================================================
#  Centreal — Полный запуск проекта (backend + frontend)
#  Автоматически:
#    - проверяет окружение (Docker, Python, Node.js)
#    - запускает базу данных через docker compose
#    - находит свободный порт для backend (8000–8010)
#    - находит свободный порт для frontend (3000–3010)
#    - запускает Django backend в отдельном окне
#    - запускает Next.js frontend в отдельном окне
#    - открывает браузер
#    - пишет логи в logs/backend/ и logs/frontend/
# ================================================================

$RootDir        = Split-Path -Parent $PSScriptRoot
$BackendDir     = Join-Path $RootDir "backend"
$FrontendDir    = Join-Path $RootDir "frontend"
$LogsDir        = Join-Path $RootDir "logs"
$BackendLogsDir = Join-Path $LogsDir "backend"
$FrontendLogsDir= Join-Path $LogsDir "frontend"
$Timestamp      = Get-Date -Format "yyyyMMdd_HHmmss"
$BackendLog     = Join-Path $BackendLogsDir  "backend_$Timestamp.log"
$FrontendLog    = Join-Path $FrontendLogsDir "frontend_$Timestamp.log"
$BackendLatest  = Join-Path $BackendLogsDir  "latest.log"
$FrontendLatest = Join-Path $FrontendLogsDir "latest.log"
$MainLog        = Join-Path $LogsDir "launch_$Timestamp.log"

# ----------------------------------------------------------------
# Вспомогательные функции
# ----------------------------------------------------------------
function Log($msg) {
    Add-Content -Path $MainLog -Value $msg -Encoding UTF8
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

function Print-Warn($text) {
    $line = "     [~~] $text"
    Write-Host $line -ForegroundColor Yellow
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

function Find-FreePort([int]$start, [int]$max) {
    $p = $start
    while ($p -le $max) {
        if (Test-PortFree $p) { return $p }
        Print-Step "Порт $p занят — проверяем $($p + 1)..."
        Log "Порт $p занят"
        $p++
    }
    return -1
}

# ----------------------------------------------------------------
# Создаём папки для логов
# ----------------------------------------------------------------
foreach ($dir in @($BackendLogsDir, $FrontendLogsDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

$StartTime = Get-Date -Format "dd.MM.yyyy HH:mm:ss"
Set-Content -Path $MainLog -Value "Centreal Launch Log — $StartTime`r`n" -Encoding UTF8
Set-Content -Path $BackendLog  -Value "Centreal Backend Log — $StartTime`r`n" -Encoding UTF8
Set-Content -Path $FrontendLog -Value "Centreal Frontend Log — $StartTime`r`n" -Encoding UTF8

# ================================================================
# ШАПКА
# ================================================================
Clear-Host
Write-Host ""
Print-Divider
Write-Host "     Centreal — Запуск проекта" -ForegroundColor Cyan
Write-Host "     $StartTime" -ForegroundColor DarkGray
Print-Divider

# ================================================================
# ШАГ 1 — Проверка структуры проекта
# ================================================================
Print-Section "Шаг 1 / Проверка структуры проекта"

foreach ($dir in @($BackendDir, $FrontendDir)) {
    if (-not (Test-Path $dir)) {
        Print-Fail "Папка не найдена: $dir"
        Log "ОШИБКА: папка не найдена: $dir"
        Write-Host ""
        Read-Host "  Нажмите Enter для выхода"
        exit 1
    }
}
Print-OK "backend/    найден"
Print-OK "frontend/   найден"

# ================================================================
# ШАГ 2 — Проверка инструментов
# ================================================================
Print-Section "Шаг 2 / Проверка инструментов"

# Docker
$dockerOk = $false
try {
    $dockerVer = & docker --version 2>&1
    Print-OK "Docker: $dockerVer"
    $dockerOk = $true
} catch {
    Print-Warn "Docker не найден — база данных не будет запущена автоматически"
    Print-Info "Убедитесь, что PostgreSQL доступен на localhost:5432"
    Log "ПРЕДУПРЕЖДЕНИЕ: Docker не найден"
}

# Python — ищем venv, иначе системный
$pythonExe = $null
$venvPaths = @(
    (Join-Path $BackendDir  "venv\.venv\Scripts\python.exe"),
    (Join-Path $BackendDir  "venv\Scripts\python.exe"),
    (Join-Path $BackendDir  ".venv\Scripts\python.exe"),
    (Join-Path $RootDir     "venv\Scripts\python.exe"),
    (Join-Path $RootDir     ".venv\Scripts\python.exe")
)
foreach ($p in $venvPaths) {
    if (Test-Path $p) {
        $pythonExe = $p
        break
    }
}
if (-not $pythonExe) {
    try {
        $null = & python --version 2>&1
        $pythonExe = "python"
    } catch {
        Print-Fail "Python не найден. Установите Python или создайте venv в backend/"
        Log "ОШИБКА: Python не найден"
        Write-Host ""
        Read-Host "  Нажмите Enter для выхода"
        exit 1
    }
}

try {
    $pyVer = & $pythonExe --version 2>&1
    if ($pythonExe -ne "python") {
        Print-OK "Python (venv): $pyVer"
        Print-Info "Путь: $pythonExe"
    } else {
        Print-OK "Python (системный): $pyVer"
    }
} catch {
    Print-Fail "Не удалось определить версию Python: $_"
    Log "ОШИБКА Python: $_"
    exit 1
}
Log "Python: $pythonExe"

# Node.js
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
# ШАГ 3 — Зависимости Node.js
# ================================================================
Print-Section "Шаг 3 / Проверка зависимостей Node.js"

$nodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Print-Step "node_modules не найден — выполняем npm install..."
    Log "Запуск npm install..."
    Push-Location $FrontendDir
    try {
        $installOut = npm install 2>&1
        Log ($installOut | Out-String)
        Print-OK "Зависимости Node.js установлены"
    } catch {
        Print-Fail "Ошибка npm install: $_"
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
# ШАГ 4 — База данных
# ================================================================
Print-Section "Шаг 4 / База данных"

if ($dockerOk) {
    Print-Step "Запускаем сервисы db и redis через docker compose..."
    Log "Запуск: docker compose up db redis -d"
    try {
        Push-Location $RootDir
        $dcOut = docker compose up db redis -d 2>&1
        Log ($dcOut | Out-String)
        Pop-Location
        Print-OK "Сервисы db и redis запущены (или уже были запущены)"
        Print-Step "Ждём готовности базы данных (5 сек.)..."
        Start-Sleep -Seconds 5
        Print-OK "Готово"
    } catch {
        Print-Warn "Не удалось запустить db через docker compose: $_"
        Log "ПРЕДУПРЕЖДЕНИЕ docker compose: $_"
        try { Pop-Location } catch {}
    }
} else {
    Print-Warn "Docker не найден — пропускаем запуск базы данных"
    Print-Info "Убедитесь, что PostgreSQL доступен на localhost:5432"
}

# ================================================================
# ШАГ 5 — Поиск свободных портов
# ================================================================
Print-Section "Шаг 5 / Поиск свободных портов"

$backendPort = Find-FreePort 8000 8010
if ($backendPort -eq -1) {
    Print-Fail "Нет свободных портов в диапазоне 8000–8010"
    Log "ОШИБКА: нет свободных портов для backend"
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}
Print-OK "Backend порт:  $backendPort"
Log "Backend порт: $backendPort"

$frontendPort = Find-FreePort 3000 3010
if ($frontendPort -eq -1) {
    Print-Fail "Нет свободных портов в диапазоне 3000–3010"
    Log "ОШИБКА: нет свободных портов для frontend"
    Write-Host ""
    Read-Host "  Нажмите Enter для выхода"
    exit 1
}
Print-OK "Frontend порт: $frontendPort"
Log "Frontend порт: $frontendPort"

$backendUrl  = "http://localhost:$backendPort"
$frontendUrl = "http://localhost:$frontendPort"
$apiUrl      = "http://localhost:$backendPort/api"

# ================================================================
# ШАГ 6 — Запуск backend в отдельном окне
# ================================================================
Print-Section "Шаг 6 / Запуск Django backend"

$backendRunnerScript = Join-Path $PSScriptRoot "_backend_runner.ps1"
Print-Step "Открываем окно backend (порт $backendPort)..."
Log "Запуск: $backendRunnerScript -Port $backendPort -LogFile $BackendLog -PythonExe $pythonExe"

$backendProc = Start-Process powershell -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", $backendRunnerScript,
    "-Port", $backendPort,
    "-LogFile", $BackendLog,
    "-PythonExe", $pythonExe
) -PassThru

Print-OK "Backend процесс запущен (PID: $($backendProc.Id))"
Log "Backend PID: $($backendProc.Id)"

# ----------------------------------------------------------------
# Проверка здоровья backend: ждём и проверяем, занят ли порт
# ----------------------------------------------------------------
Print-Step "Проверяем запуск backend (ожидание 6 сек.)..."
Start-Sleep -Seconds 6

$script:backendHealthOk = -not (Test-PortFree $backendPort)
if ($script:backendHealthOk) {
    Print-OK "Backend принимает соединения на порту $backendPort"
    Log "Backend health check: OK — порт $backendPort занят"
} else {
    Print-Warn "Backend НЕ отвечает на порту $backendPort"
    Print-Warn "Вероятная причина: ошибка подключения к базе данных (psycopg2/PostgreSQL)"
    Print-Info "Откройте окно «Centreal — Backend» и посмотрите вывод ошибки."
    Print-Info "Или откройте лог backend:"
    Print-Info "  $BackendLog"
    Print-Info "Frontend запустится независимо — он может работать без backend."
    Log "Backend health check: FAIL — порт $backendPort не занят через 6 сек после запуска"
    Log "Backend лог: $BackendLog"
}

# ================================================================
# ШАГ 7 — Запуск frontend в отдельном окне
# ================================================================
Print-Section "Шаг 7 / Запуск Next.js frontend"

$frontendRunnerScript = Join-Path $PSScriptRoot "_frontend_runner.ps1"
Print-Step "Открываем окно frontend (порт $frontendPort)..."
Log "Запуск: $frontendRunnerScript -Port $frontendPort -ApiUrl $apiUrl -LogFile $FrontendLog"

$frontendProc = Start-Process powershell -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", $frontendRunnerScript,
    "-Port", $frontendPort,
    "-ApiUrl", $apiUrl,
    "-LogFile", $FrontendLog
) -PassThru

Print-OK "Frontend запущен (PID: $($frontendProc.Id))"
Log "Frontend PID: $($frontendProc.Id)"

# ================================================================
# ШАГ 8 — Автоматически открываем браузер
# ================================================================
Print-Section "Шаг 8 / Открытие браузера"
Print-Step "Браузер откроется через 6 секунд (ожидаем запуск серверов)..."
Log "Открытие браузера: $frontendUrl"

$null = Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Seconds 6
    Start-Process $u
} -ArgumentList $frontendUrl

# ================================================================
# ИТОГ — Адреса, логи, инструкции
# ================================================================
Write-Host ""
Print-Divider
if ($script:backendHealthOk) {
    Write-Host "     Проект запущен!" -ForegroundColor Green
} else {
    Write-Host "     Проект запущен (backend требует внимания)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "     Frontend:  $frontendUrl" -ForegroundColor Yellow
if ($script:backendHealthOk) {
    Write-Host "     Backend:   $backendUrl" -ForegroundColor Yellow
} else {
    Write-Host "     Backend:   $backendUrl  [НЕ ОТВЕЧАЕТ]" -ForegroundColor Red
    Write-Host "     Backend лог: $BackendLog" -ForegroundColor Red
}
Write-Host "     API URL:   $apiUrl"      -ForegroundColor DarkGray
Write-Host ""
Write-Host "     Backend лог:   $BackendLog"  -ForegroundColor DarkGray
Write-Host "     Frontend лог:  $FrontendLog" -ForegroundColor DarkGray
Write-Host "     Запуск лог:    $MainLog"     -ForegroundColor DarkGray
Print-Divider
Write-Host ""
Write-Host "     Как остановить проект:" -ForegroundColor White
Write-Host "       1. Закройте окно «Centreal — Backend»" -ForegroundColor DarkGray
Write-Host "       2. Закройте окно «Centreal — Frontend»" -ForegroundColor DarkGray
Write-Host "       3. Чтобы остановить базу данных:" -ForegroundColor DarkGray
Write-Host "            docker compose stop db redis" -ForegroundColor DarkGray
Write-Host ""
Print-Divider
Write-Host ""

Log ""
Log "=== Итог запуска ==="
Log "Frontend:  $frontendUrl (PID: $($frontendProc.Id))"
Log "Backend:   $backendUrl  (PID: $($backendProc.Id))"
Log "API URL:   $apiUrl"
Log "Backend лог:  $BackendLog"
Log "Frontend лог: $FrontendLog"

# Обновляем latest.log для обоих сервисов по мере их записи
Copy-Item -Path $BackendLog  -Destination $BackendLatest  -Force -ErrorAction SilentlyContinue
Copy-Item -Path $FrontendLog -Destination $FrontendLatest -Force -ErrorAction SilentlyContinue

# Закрываем фоновые задания
Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue

Read-Host "  Нажмите Enter для закрытия этого окна (серверы продолжат работу)"
