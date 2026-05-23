# Развертывание

## Обзор

Это руководство описывает процесс развертывания всех компонентов Your Sign AI в production окружении.

## Компоненты для развертывания

1. **Frontend** - Vercel
2. **Backend Inference** - Render (рекомендуется) или Vercel Serverless
3. **Database** - Supabase Cloud
4. **Storage** - Vercel Blob Storage

## Развертывание Frontend

### Подготовка

1. Убедитесь, что код находится в Git репозитории
2. Подключите репозиторий к Vercel

### Через Vercel Dashboard

1. Перейдите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Импортируйте репозиторий
4. Настройте проект:
   - **Framework Preset**: Next.js
   - **Root Directory**: `site`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Переменные окружения

Добавьте в Vercel Dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_INFERENCE_URL=https://your-inference-api.vercel.app
```

### Развертывание

Vercel автоматически развернет приложение при push в main ветку.

## Развертывание Backend Inference

### Вариант 1: Render (Рекомендуется)

Render предоставляет постоянный сервер, что идеально для ML моделей.

#### Подготовка

1. Создайте аккаунт на [render.com](https://render.com)
2. Подключите ваш Git репозиторий

#### Создание Web Service

1. В Render Dashboard нажмите "New +" → "Web Service"
2. Подключите репозиторий
3. Настройте:
   - **Name**: `your-signature-inference`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory**: `inference`

#### Переменные окружения

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MODEL_NAME=v1
ENVIRONMENT=production
BLOB_READ_WRITE_TOKEN=your_blob_token
FRONTEND_URL=https://your-signature-ai.vercel.app,https://your-signature-ai-*.vercel.app
PORT=10000
```

#### Развертывание

Render автоматически развернет сервис при push в подключенную ветку.

### Вариант 2: Vercel (Альтернатива)

Vercel может использоваться как альтернативный вариант.

#### Подготовка

1. Убедитесь, что `vercel.json` настроен
2. Подключите репозиторий к Vercel

#### Через Vercel Dashboard

1. Создайте новый проект для inference сервера
2. Настройте:
   - **Root Directory**: `inference`
   - **Framework Preset**: Other

#### Переменные окружения

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MODEL_NAME=v1
ENVIRONMENT=production
BLOB_READ_WRITE_TOKEN=your_blob_token
FRONTEND_URL=https://your-signature-ai.vercel.app,https://your-signature-ai-*.vercel.app
```

Preview-деплои Vercel: в `FRONTEND_URL` добавьте glob-паттерн с `*` (см. `inference/utils/cors_origins.py`).

#### Развертывание

Vercel автоматически развернет serverless функции.

**Примечание**: На Vercel возможны cold starts и ограничения памяти. Render рекомендуется для ML inference.

## Настройка Supabase

### Production проект

1. Создайте production проект на Supabase
2. Примените миграции:

```bash
npx supabase db push --project-ref your-project-ref
```

### Настройка RLS

RLS политики применяются автоматически через миграции.

### Настройка Auth

1. В Supabase Dashboard → Authentication → URL Configuration
2. Добавьте ваш production URL в:
   - Site URL
   - Redirect URLs

## Настройка Vercel Blob Storage

### Создание хранилища

1. В Vercel Dashboard → Storage
2. Создайте Blob Store
3. Получите `BLOB_READ_WRITE_TOKEN`

### Использование

Токен автоматически используется inference сервером для хранения моделей.

## CI/CD

### Render

Render автоматически развертывает при push в подключенную ветку. Можно настроить:
- Автоматические деплои при push
- Manual deploys
- Rollback к предыдущим версиям

### GitHub Actions (для Vercel)

Если используете Vercel для backend, пример workflow:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.FRONTEND_PROJECT_ID }}
          working-directory: ./site

  deploy-backend-vercel:
    runs-on: ubuntu-latest
    if: false  # Отключено, если используете Render
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.BACKEND_PROJECT_ID }}
          working-directory: ./inference
```

**Примечание**: Для Render CI/CD настраивается автоматически при подключении репозитория.

## Мониторинг

### Vercel Analytics

Включите Vercel Analytics для отслеживания:
- Производительности
- Ошибок
- Использования

### Supabase Monitoring

Используйте Supabase Dashboard для мониторинга:
- Запросов к БД
- Использования ресурсов
- Логов

### Health Checks

Настройте периодические проверки:

```bash
# Frontend
curl https://your-frontend.vercel.app

# Backend (Render)
curl https://your-service.onrender.com/health

# Backend (Vercel, если используется)
curl https://your-backend.vercel.app/health
```

## Безопасность

### Рекомендации

1. **Никогда не коммитьте** `.env` файлы
2. Используйте **Secrets** в Vercel для переменных окружения
3. Регулярно **обновляйте зависимости**
4. Используйте **HTTPS** везде
5. Настройте **CORS** правильно

### Проверка безопасности

- Проверьте RLS политики в Supabase
- Убедитесь, что service role key не доступен на клиенте
- Проверьте настройки CORS

## Масштабирование

### Frontend

Vercel автоматически масштабирует frontend при необходимости.

### Backend

- **Render**: Автоматически масштабируется. Убедитесь, что модель помещается в доступную память
- **Vercel**: Serverless функции масштабируются автоматически. Убедитесь, что:
  - Модели помещаются в доступную память
  - Время выполнения в пределах лимитов

### Database

Supabase автоматически масштабируется. При необходимости:
- Обновите план подписки
- Оптимизируйте запросы
- Используйте индексы

## Откат изменений

### Vercel

В Vercel Dashboard можно откатить к предыдущей версии:
1. Перейдите в Deployments
2. Выберите предыдущую версию
3. Нажмите "Promote to Production"

### Database

Для отката миграций:

```bash
npx supabase db reset --project-ref your-project-ref
```

## Дополнительные ресурсы

- [Установка](SETUP.md)
- [Решение проблем](TROUBLESHOOTING.md)

