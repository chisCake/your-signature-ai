param(
    [int]$w = 1
)

# Проверяем, что количество воркеров больше 0
if ($w -lt 1) {
    Write-Error "Количество воркеров должно быть больше 0"
    exit 1
}

Write-Host "Запуск inference сервера с $w воркер(ами)..." -ForegroundColor Green

# Активируем виртуальное окружение
Write-Host "Активация виртуального окружения..." -ForegroundColor Yellow
try {
    & "render-inference\.venv\Scripts\Activate.ps1"
    Write-Host "Виртуальное окружение активировано успешно" -ForegroundColor Green
} catch {
    Write-Error "Ошибка при активации виртуального окружения: $_"
    exit 1
}

# Переходим в директорию render-inference
Set-Location "render-inference"

# Запускаем uvicorn сервер
Write-Host "Запуск uvicorn сервера..." -ForegroundColor Yellow
uvicorn main:app --host 0.0.0.0 --port 8000 --workers $w

if ($LASTEXITCODE -ne 0) {
    Write-Error "Ошибка при запуске uvicorn сервера"
    exit 1
}
