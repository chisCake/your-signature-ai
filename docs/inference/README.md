# Inference Server (FastAPI) - Документация

## Обзор

Inference сервер Your Sign AI - это FastAPI приложение, которое предоставляет API для верификации подписей с использованием обученной PyTorch модели. Сервер загружает модель в память и обрабатывает запросы на сравнение подписей.

## Структура проекта

```
inference/
├── main.py                 # Точка входа FastAPI приложения
├── dependencies.py         # FastAPI dependencies
├── routes/                 # API endpoints
│   ├── health.py          # Health check
│   ├── forgery_by_id.py   # Верификация по ID
│   ├── forgery_by_data.py # Верификация по данным
│   ├── model.py           # Управление моделью
│   └── model_upload.py    # Загрузка моделей
├── utils/                  # Утилиты
│   ├── model_loader.py    # Загрузчик моделей
│   ├── model_manager.py   # Менеджер моделей
│   ├── preprocessing.py   # Предобработка данных
│   ├── supabase_client.py # Клиент Supabase
│   └── blob_client.py     # Клиент Blob Storage
├── models/                 # Определения моделей
│   ├── v1.py             # Модель v1
│   └── v2.py             # Модель v2
├── requirements.txt        # Зависимости
└── vercel.json            # Конфигурация Vercel
```

## Технологии

- **FastAPI** - Web framework
- **PyTorch** - ML framework для inference
- **Uvicorn** - ASGI server
- **Mangum** - Adapter для Vercel serverless
- **Supabase** - Database client
- **Vercel Blob** - Storage для моделей (production)

## Основные функции

1. **Верификация подписей** - Сравнение двух подписей на схожесть
2. **Управление моделями** - Загрузка, активация, переключение моделей
3. **Health monitoring** - Проверка состояния сервера и модели
4. **Hotswap моделей** - Переключение моделей без downtime

## Установка

### Требования

- Python 3.12+
- pip

### Установка зависимостей

```bash
cd inference
pip install -r requirements.txt
```

### Переменные окружения

Создайте файл `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MODEL_NAME=v1
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:3000

# Для production
BLOB_READ_WRITE_TOKEN=your_blob_token
```

## Запуск

### Разработка

```bash
python main.py
```

Или с uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Production (Vercel)

Сервер автоматически развертывается на Vercel при push в репозиторий. Конфигурация в `vercel.json`.

## API Endpoints

Подробнее см. [API документация](API.md)

### Основные endpoints

- `GET /` - Информация о сервере
- `GET /health` - Health check
- `POST /forgery-by-id/` - Верификация по ID подписей
- `POST /forgery-by-data/` - Верификация по данным
- `GET /model/info` - Информация о моделях
- `POST /model/upload` - Загрузка новой модели
- `POST /model/activate` - Активация модели
- `DELETE /model/delete` - Удаление модели

## Управление моделями

Подробнее см. [Управление моделями](MODEL_MANAGEMENT.md)

### Загрузка модели

Модель состоит из двух файлов:
- `.pt` - Веса модели (PyTorch checkpoint)
- `.py` - Определение архитектуры модели

### Hotswap

Сервер поддерживает переключение моделей без перезапуска:
- **Zero Downtime** - Новая модель загружается параллельно со старой
- **Sequential** - Старая модель выгружается, затем загружается новая

## Предобработка данных

Подробнее см. [Предобработка](PREPROCESSING.md)

Данные подписей преобразуются из CSV формата в тензоры для модели:
1. Парсинг CSV
2. Извлечение признаков
3. Нормализация
4. Преобразование в тензор

## Развертывание

Подробнее см. [Развертывание](DEPLOYMENT.md)

### Render (Рекомендуется)

Сервер развертывается как Web Service на Render. Это обеспечивает:
- Постоянный сервер без cold starts
- Модель всегда в памяти
- Больше доступной памяти для моделей

### Vercel Serverless (Альтернатива)

Сервер может быть развернут как serverless функции на Vercel. Каждый endpoint становится отдельной функцией. Имейте в виду ограничения по памяти и cold starts.

### Локальное развертывание

Для локального развертывания используйте uvicorn или другой ASGI сервер.

## Мониторинг

### Health Check

```bash
curl http://localhost:8000/health
```

Ответ:
```json
{
  "status": "healthy",
  "supabase_connected": true,
  "model_loaded": true,
  "model_info": {
    "path": "models/v1.pt",
    "device": "cpu",
    "architecture": "..."
  }
}
```

### Логирование

Сервер использует стандартное Python logging:
- INFO - Общая информация
- WARNING - Предупреждения
- ERROR - Ошибки

## Производительность

### Оптимизации

1. **Модель в памяти** - Модель загружается один раз при старте
2. **Batch processing** - Возможность обработки нескольких запросов одновременно
3. **Кэширование** - Кэширование эмбеддингов (при необходимости)

### Ограничения

- Serverless функции имеют ограничения по времени выполнения
- Ограничения памяти для больших моделей
- Холодный старт при первом запросе

## Безопасность

- Service role key используется только на сервере
- CORS настроен для разрешенных доменов
- Валидация всех входных данных
- Обработка ошибок без раскрытия внутренней информации

## Дополнительные ресурсы

- [API документация](API.md)
- [Управление моделями](MODEL_MANAGEMENT.md)
- [Предобработка](PREPROCESSING.md)
- [Развертывание](DEPLOYMENT.md)
- [Архитектура системы](../ARCHITECTURE.md)

