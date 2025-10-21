# Signature Inference Server

FastAPI сервер для анализа подписей с использованием PyTorch модели.

## Особенности

- ✅ Проверка переменных окружения при запуске
- ✅ Инициализация Supabase клиента с проверкой подключения
- ✅ Загрузка PyTorch модели в память для долгосрочного использования
- ✅ Health endpoint для мониторинга состояния сервера
- ✅ Автоматическое определение устройства (CUDA/MPS/CPU)

## Установка

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Заполните переменные окружения в `.env`:
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
MODEL_PATH=models/v1.pt
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
FRONTEND_URL=http://localhost:3000,https://yourdomain.com
```

## Запуск

### Разработка
```bash
python main.py
```

### Продакшн
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### GET /
Корневой endpoint с информацией о сервере.

### GET /health
Проверка состояния сервера. Возвращает:
- Статус сервера
- Состояние подключения к Supabase
- Состояние загрузки модели
- Информацию о модели

Пример ответа:
```json
{
  "status": "healthy",
  "supabase_connected": true,
  "model_loaded": true,
  "model_info": {
    "path": "models/v1.pt",
    "device": "cuda",
    "model_type": "SignatureEncoder",
    "architecture": "CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding",
    "config": {
      "in_features": 10,
      "conv_channels": [64, 128],
      "gru_hidden": 256,
      "gru_layers": 2,
      "embedding_dim": 128,
      "dropout": 0.3
    }
  }
}
```

### POST /forgery-by-id
Анализ подделки по ID оригинальной и поддельной подписи из БД.

**Запрос:**
```json
{
  "original_id": "signature_id_1",
  "forgery_id": "signature_id_2"
}
```

**Ответ:**
```json
{
  "is_forgery": true,
  "similarity_score": 0.45,
  "threshold": 0.7,
  "original_id": "signature_id_1",
  "forgery_id": "signature_id_2",
  "error": null
}
```

### POST /forgery-by-data
Анализ подделки по ID оригинальной подписи и данным поддельной подписи.

**Запрос (CSV строка):**
```json
{
  "original_id": "signature_id_1",
  "forgery_data": "t,x,y,p\n0,100,200,0.5\n1,105,205,0.6\n..."
}
```

**Запрос (массив данных):**
```json
{
  "original_id": "signature_id_1",
  "forgery_data": [[0, 100, 200, 0.5], [1, 105, 205, 0.6], ...]
}
```

**Ответ:**
```json
{
  "is_forgery": true,
  "similarity_score": 0.45,
  "threshold": 0.7,
  "original_id": "signature_id_1",
  "forgery_id": null,
  "error": null
}
```

## Структура проекта

```
render-inference/
├── main.py                 # Основной файл FastAPI приложения
├── routes/                 # Эндпоинты
│   ├── health.py          # Health check и корневой эндпоинт
│   └── forgery.py         # Анализ подделок подписей
├── utils/
│   ├── supabase_client.py  # Клиент для работы с Supabase
│   ├── model_loader.py     # Загрузчик PyTorch модели
│   └── preprocessing.py    # Предобработка данных подписей
├── models/
│   ├── v1.py              # Локальная копия SignatureEncoder
│   └── v1.pt              # Файл модели PyTorch
├── requirements.txt        # Зависимости Python
└── env.example            # Пример переменных окружения
```

## Переменные окружения

| Переменная | Описание | Обязательная |
|------------|----------|--------------|
| `SUPABASE_URL` | URL Supabase проекта | Да |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role ключ Supabase | Да |
| `MODEL_PATH` | Путь к файлу модели (.pt) | Да |
| `HOST` | Хост для запуска сервера | Нет (по умолчанию: 0.0.0.0) |
| `PORT` | Порт для запуска сервера | Нет (по умолчанию: 8000) |
| `LOG_LEVEL` | Уровень логирования | Нет (по умолчанию: INFO) |
| `FRONTEND_URL` | URL фронтенда для CORS (можно несколько через запятую) | Нет (по умолчанию: http://localhost:3000) |

## Логирование

Сервер использует стандартное Python логирование с уровнем INFO. Логи включают:
- Информацию о запуске и инициализации
- Состояние подключений
- Ошибки и предупреждения

## Мониторинг

Используйте `/health` endpoint для мониторинга состояния сервера. Этот endpoint проверяет:
- Доступность Supabase
- Загруженность модели
- Общее состояние сервера
