# Развертывание Inference Server

## Обзор

Inference сервер может быть развернут как на локальной машине, так и на Render (основной вариант) или Vercel (альтернативный вариант) в качестве serverless функций.

## Локальное развертывание

### Требования

- Python 3.12+
- pip
- Доступ к Supabase

### Установка

```bash
cd inference
pip install -r requirements.txt
```

### Настройка переменных окружения

Создайте файл `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MODEL_NAME=v1
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:3000
```

### Запуск

```bash
python main.py
```

Или с uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Развертывание на Render (Рекомендуется)

Render - основной вариант развертывания inference сервера. Render предоставляет постоянный сервер, что идеально подходит для ML моделей, которые должны оставаться в памяти.

### Подготовка

1. Создайте аккаунт на [render.com](https://render.com)
2. Подключите ваш Git репозиторий

### Создание Web Service

1. В Render Dashboard нажмите "New +" → "Web Service"
2. Подключите ваш репозиторий
3. Настройте сервис:
   - **Name**: `your-signature-inference`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory**: `inference`

### Переменные окружения

Добавьте в Render Dashboard → Environment:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MODEL_NAME=v1
ENVIRONMENT=production
BLOB_READ_WRITE_TOKEN=your_blob_token
FRONTEND_URL=https://your-frontend.vercel.app
PORT=10000
```

### Развертывание

Render автоматически развернет сервис при push в подключенную ветку (обычно `main`).

### Проверка развертывания

После развертывания проверьте:

```bash
curl https://your-service.onrender.com/health
```

### Преимущества Render

- **Постоянный сервер** - Модель остается в памяти между запросами
- **Нет cold start** - Быстрый отклик на запросы
- **Больше памяти** - Доступно больше памяти для больших моделей
- **Простое управление** - Удобный dashboard для мониторинга

### Мониторинг на Render

- **Logs** - Доступны в реальном времени в Render Dashboard
- **Metrics** - CPU, память, запросы
- **Health Checks** - Автоматические проверки состояния

## Развертывание на Vercel (Альтернатива)

Vercel может использоваться как альтернативный вариант развертывания. На Vercel сервер работает как serverless функции.

### Подготовка

1. **Установите Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Войдите в Vercel**:
   ```bash
   vercel login
   ```

### Конфигурация

Файл `vercel.json` уже настроен:

```json
{
  "builds": [
    {
      "src": "main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "main.py"
    }
  ]
}
```

### Переменные окружения

Настройте переменные окружения в Vercel Dashboard:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MODEL_NAME`
- `ENVIRONMENT=production`
- `BLOB_READ_WRITE_TOKEN` (для production)
- `FRONTEND_URL`

### Развертывание

```bash
vercel
```

Или через Git:

```bash
git push origin main
```

Vercel автоматически развернет приложение при push.

### Проверка развертывания

После развертывания проверьте:

```bash
curl https://your-app.vercel.app/health
```

### Структура serverless функций

На Vercel каждый endpoint становится отдельной serverless функцией:

- `/health` → `health` функция
- `/forgery-by-id/` → `forgery_by_id` функция
- `/forgery-by-data/` → `forgery_by_data` функция
- и т.д.

### Особенности Vercel

- **Cold Start** - Модель загружается при первом запросе после простоя
- **Ограничения памяти** - Hobby: 1024 MB, Pro: 3008 MB
- **Таймауты** - Hobby: 10 секунд, Pro: 60 секунд

## Модели в production

### Blob Storage

В production модели хранятся в Vercel Blob Storage:

1. **Загрузка модели**:
   - Модель загружается через frontend API
   - Файлы сохраняются в Blob Storage
   - URL файлов сохраняются в метаданных

2. **Синхронизация при старте**:
   - **На Render**: При первом запуске сервиса или при обновлении
   - **На Vercel**: При холодном старте функции
   - Модели синхронизируются из Blob Storage
   - Кэшируются локально

### Локальное кэширование

- **На Render**: Модели хранятся в файловой системе сервера
- **На Vercel**: Модели кэшируются в `/tmp` директории serverless функции

## Мониторинг

### Render Dashboard

На Render доступны:
- **Logs** - Логи в реальном времени
- **Metrics** - CPU, память, запросы
- **Events** - События развертывания

### Vercel Analytics (для Vercel)

Если используете Vercel:
- Количество запросов
- Время ответа
- Ошибки

### Логи

- **Render**: Логи доступны в Render Dashboard в реальном времени
- **Vercel**: Function logs, Build logs, Runtime logs в Vercel Dashboard

### Health Check

Настройте периодические health checks:

```bash
# Render
curl https://your-service.onrender.com/health

# Vercel
curl https://your-app.vercel.app/health
```

## Оптимизация

### Cold Start

- **Render**: Нет cold start - сервер работает постоянно, модель всегда в памяти
- **Vercel**: Холодный старт может занять время из-за загрузки модели:
  1. **Keep-alive** - Используйте Vercel Pro для keep-alive функций
  2. **Предзагрузка** - Модели загружаются при первом запросе
  3. **Кэширование** - Модели кэшируются в `/tmp`

### Память

- **Render**: Доступно больше памяти (зависит от плана)
- **Vercel**: Serverless функции имеют ограничения:
  - Hobby: 1024 MB
  - Pro: 3008 MB

Убедитесь, что модель помещается в доступную память.

### Таймауты

- **Render**: Нет жестких таймаутов для запросов
- **Vercel**:
  - Hobby: 10 секунд
  - Pro: 60 секунд (или больше)

Убедитесь, что inference выполняется в пределах таймаута (для Vercel).

## Troubleshooting

### Модель не загружается

1. Проверьте размер модели
2. Проверьте доступность Blob Storage
3. Проверьте логи:
   - **Render**: Render Dashboard → Logs
   - **Vercel**: Vercel Dashboard → Function logs

### Медленный ответ

1. Проверьте размер модели
2. Используйте более быстрый device (если доступно)
3. Оптимизируйте предобработку
4. **На Render**: Проверьте, что сервис не "засыпает" (используйте Render Pro или настройте keep-alive)

### Ошибки памяти

1. Уменьшите размер модели
2. Используйте quantization
3. Увеличьте лимит памяти:
   - **Render**: Обновите план подписки
   - **Vercel**: Перейдите на Pro план

### Render: Сервис засыпает

На бесплатном плане Render сервисы могут "засыпать" после периода бездействия. Решения:
1. Используйте Render Pro план
2. Настройте внешний keep-alive сервис для периодических запросов
3. Используйте Render Cron Jobs для поддержания активности

## CI/CD

### Render

Render автоматически развертывает при push в подключенную ветку. Можно настроить:
- Автоматические деплои при push
- Manual deploys
- Rollback к предыдущим версиям

### Vercel (альтернатива)

Пример workflow для Vercel:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./inference
```

## Сравнение Render vs Vercel

| Характеристика | Render | Vercel |
|----------------|--------|--------|
| Тип сервиса | Web Service (постоянный) | Serverless Functions |
| Cold Start | Нет | Да (при простоях) |
| Память | Больше доступно | Ограничено планом |
| Таймауты | Нет жестких | Есть (10-60 сек) |
| Подходит для ML | ✅ Идеально | ⚠️ С ограничениями |
| Стоимость | От $7/мес | От $0 (Hobby) |

**Рекомендация**: Используйте Render для inference сервера, так как ML модели требуют постоянного сервера для оптимальной производительности.

## Дополнительные ресурсы

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs) (альтернатива)
- [Python Runtime на Render](https://render.com/docs/python)
- [API документация](API.md)

