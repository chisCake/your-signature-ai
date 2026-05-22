# Установка и настройка

## Обзор

Это руководство поможет вам установить и настроить все компоненты проекта Your Sign AI для локальной разработки.

## Требования

### Общие требования

- Node.js 18+ и npm
- Python 3.12+
- Git
- Supabase аккаунт (или локальный Supabase)

### Дополнительно

- Vercel аккаунт (для production развертывания)
- Google Colab аккаунт (для обучения моделей)

## Установка компонентов

### 1. Клонирование репозитория

```bash
git clone https://github.com/chisCake/your-signature-ai.git
cd your-signature-ai
```

### 2. Frontend (Next.js)

```bash
cd site
npm install
```

Создайте файл `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_INFERENCE_URL=http://localhost:8000
```

Запуск:

```bash
npm run dev
```

Frontend будет доступен на `http://localhost:3000`

### 3. Backend Inference (FastAPI)

```bash
cd inference
pip install -r requirements.txt
```

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

Запуск:

```bash
python main.py
```

Или с uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend будет доступен на `http://localhost:8000`

### 4. Database (Supabase)

#### Вариант 1: Supabase Cloud

1. Создайте проект на [supabase.com](https://supabase.com)
2. Получите URL и ключи из настроек проекта
3. Примените миграции:

```bash
npx supabase db push
```

#### Вариант 2: Локальный Supabase

```bash
# Установка Supabase CLI
npm install -g supabase

# Инициализация
supabase init

# Запуск локального Supabase
supabase start

# Применение миграций
supabase db reset
```

Локальный Supabase будет доступен на `http://localhost:54321`

### 5. Training (Google Colab)

1. Откройте `training/main.example.ipynb` из репозитория в Google Colab (Save a copy → работайте как `main.ipynb` локально / на Drive)
2. Подключите Google Drive
3. Настройте переменные окружения через Secrets
4. Запустите ячейки по порядку
5. После изменения ячеек: `npm run notebook:sync` из корня репозитория, затем коммит `main.example.ipynb`

## Настройка Supabase

### 1. Создание таблиц

Миграции находятся в `supabase/migrations/`. Примените их:

```bash
cd supabase
npx supabase db reset
```

### 2. Настройка RLS

RLS политики применяются автоматически через миграции. Проверьте их в Supabase Dashboard.

### 3. Настройка Auth

В Supabase Dashboard:
1. Перейдите в Authentication → Settings
2. Настройте Email templates (опционально)
3. Настройте Redirect URLs

## Первый запуск

### 1. Запуск всех компонентов

**Терминал 1 - Frontend**:
```bash
cd site
npm run dev
```

**Терминал 2 - Backend**:
```bash
cd inference
python main.py
```

**Терминал 3 - Supabase** (если локально):
```bash
supabase start
```

### 2. Проверка работоспособности

1. Откройте `http://localhost:3000`
2. Зарегистрируйтесь
3. Создайте первую подпись
4. Проверьте health endpoint: `http://localhost:8000/health`

### 3. Загрузка модели

Если у вас есть обученная модель:

1. Скопируйте `.pt` и `.py` файлы в `inference/models/`
2. Перезапустите inference сервер
3. Проверьте `/model/info` endpoint

## Troubleshooting

### Проблемы с подключением к Supabase

- Проверьте URL и ключи в `.env` файлах
- Убедитесь, что Supabase проект активен
- Проверьте настройки сети/firewall

### Проблемы с моделями

- Убедитесь, что файлы `.pt` и `.py` совместимы
- Проверьте логи inference сервера
- Убедитесь, что модель загружена: `GET /health`

### Проблемы с портами

Если порты заняты:

- Frontend: Измените порт в `package.json` или используйте `-p 3001`
- Backend: Измените `PORT` в `.env`

## Дополнительные ресурсы

- [Развертывание](DEPLOYMENT.md)
- [AGENTS.md](../../AGENTS.md) — контекст для разработчиков и ИИ-агентов
- [Roadmap](../ROADMAP.md)
- [Решение проблем](TROUBLESHOOTING.md)

