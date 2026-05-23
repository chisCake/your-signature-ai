# Inference API

## Обзор

Inference API предоставляет endpoints для верификации подписей и управления моделями. Все endpoints возвращают JSON ответы.

## Base URL

- Development: `http://localhost:8000`
- Production: `https://your-inference-api.vercel.app`

## Аутентификация

В настоящее время API не требует аутентификации для основных endpoints. Для загрузки моделей требуется административный доступ через frontend API.

## Endpoints

### GET /

Информация о сервере.

**Response**:
```json
{
  "name": "Signature Inference Server",
  "version": "1.0.0",
  "description": "FastAPI сервер для анализа подписей"
}
```

### GET /health

Проверка состояния сервера и модели.

**Response**:
```json
{
  "status": "healthy",
  "supabase_connected": true,
  "model_loaded": true,
  "model_info": {
    "path": "models/v1.pt",
    "device": "cpu",
    "model_type": "SignatureEncoder",
    "architecture": "CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding",
    "config": {
      "in_features": 10,
      "conv_channels": [64, 128],
      "gru_hidden": 256,
      "gru_layers": 2,
      "embedding_dim": 128,
      "dropout": 0.3
    },
    "total_parameters": 1234567,
    "trainable_parameters": 1234567
  }
}
```

**Status Codes**:
- `200` - Сервер работает нормально
- `503` - Сервер недоступен или модель не загружена

### POST /forgery-by-id/

Анализ подделки по ID оригинальной и поддельной подписи из БД.

**Request Body**:
```json
{
  "original_id": "uuid-оригинальной-подписи",
  "forgery_id": "uuid-поддельной-подписи"
}
```

**Response** — см. актуальную схему в [INFERENCE_API.md](../API/INFERENCE_API.md) (`threshold` из manifest, поля `is_not_signature`, `anomaly_score`, …).

**Status Codes**:
- `200` - Успешный анализ
- `404` - Подпись не найдена
- `500` - Ошибка обработки

**Поля ответа** (основные):
- `is_forgery`, `similarity_score`, `threshold`
- `is_not_signature`, `rejection_reason` — отклонение Mahalanobis («не подпись»)
- `anomaly_score`, `anomaly_threshold` — если в bundle включён anomaly
- `error` — при сбое анализа

### POST /forgery-by-data/

Анализ подделки по ID оригинальной подписи и данным поддельной подписи.

**Request Body (CSV строка)**:
```json
{
  "original_id": "uuid-оригинальной-подписи",
  "forgery_data": "t,x,y,p\n0,100,200,0.5\n1,105,205,0.6\n..."
}
```

**Request Body (массив данных)**:
```json
{
  "original_id": "uuid-оригинальной-подписи",
  "forgery_data": [[0, 100, 200, 0.5], [1, 105, 205, 0.6], ...]
}
```

**Response** — как у `/forgery-by-id/` ([INFERENCE_API.md](../API/INFERENCE_API.md)).

**Status Codes**:
- `200` - Успешный анализ
- `400` - Неверный формат данных
- `404` - Оригинальная подпись не найдена
- `500` - Ошибка обработки

### GET /model/info

Получение информации о всех моделях.

**Response**:
```json
{
  "active_model": "v1",
  "models": {
    "v1": {
      "name": "v1",
      "state": "active",
      "is_active": true,
      "is_ready": true,
      "error": null,
      "created_at": 1234567890.0,
      "last_used": 1234567890.0,
      "storage": {
        "type": "local",
        "synced_at": 1234567890.0
      },
      "model_info": {
        "path": "models/v1.pt",
        "device": "cpu",
        "architecture": "..."
      }
    }
  },
  "total_models": 1
}
```

### POST /model/upload

Загрузка новой модели (только для администраторов через frontend API).

**Request Body** (multipart/form-data):
```
model_name: string
pt_file: File (.pt)
py_file: File (.py)
swap_strategy: "zero_downtime" | "sequential" (optional, default: "zero_downtime")
```

**Response**:
```json
{
  "success": true,
  "strategy": "zero_downtime",
  "new_model": "v2",
  "old_model": "v1",
  "message": "Model v2 activated successfully",
  "storage": {
    "type": "blob",
    "pt_blob_path": "models/v2.pt",
    "py_blob_path": "models/v2.py",
    "pt_download_url": "https://...",
    "py_download_url": "https://...",
    "synced_at": 1234567890.0
  }
}
```

**Status Codes**:
- `200` - Модель успешно загружена
- `400` - Неверный формат файлов
- `500` - Ошибка загрузки

### POST /model/activate

Активация существующей модели.

**Request Body**:
```json
{
  "model_name": "v2"
}
```

**Response**:
```json
{
  "success": true,
  "active_model": "v2",
  "message": "Model v2 activated"
}
```

**Status Codes**:
- `200` - Модель активирована
- `404` - Модель не найдена
- `500` - Ошибка активации

### DELETE /model/delete

Удаление модели.

**Request Body**:
```json
{
  "model_name": "v1"
}
```

**Response**:
```json
{
  "success": true,
  "model_name": "v1",
  "deleted_files": ["models/v1.pt", "models/v1.py"],
  "message": "Model v1 deleted successfully"
}
```

**Status Codes**:
- `200` - Модель удалена
- `400` - Нельзя удалить активную модель
- `404` - Модель не найдена

## Формат данных подписи

### CSV формат

```csv
t,x,y,p
0,100,200,0.5
10,105,205,0.6
20,110,210,0.7
...
```

Где:
- `t` - Время в миллисекундах от начала
- `x` - X координата
- `y` - Y координата
- `p` - Давление (0.0 - 1.0)

### Массив данных

```json
[
  [0, 100, 200, 0.5],
  [10, 105, 205, 0.6],
  [20, 110, 210, 0.7]
]
```

## Обработка ошибок

Все endpoints возвращают стандартный формат ошибки:

```json
{
  "detail": "Описание ошибки"
}
```

### Статус коды

- `200` - Успешный запрос
- `400` - Ошибка валидации
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера
- `503` - Сервис недоступен

## Примеры использования

### cURL

```bash
# Health check
curl http://localhost:8000/health

# Верификация по ID
curl -X POST http://localhost:8000/forgery-by-id/ \
  -H "Content-Type: application/json" \
  -d '{
    "original_id": "uuid-1",
    "forgery_id": "uuid-2"
  }'

# Верификация по данным
curl -X POST http://localhost:8000/forgery-by-data/ \
  -H "Content-Type: application/json" \
  -d '{
    "original_id": "uuid-1",
    "forgery_data": "t,x,y,p\n0,100,200,0.5"
  }'
```

### Python

```python
import requests

# Health check
response = requests.get('http://localhost:8000/health')
print(response.json())

# Верификация
response = requests.post(
    'http://localhost:8000/forgery-by-id/',
    json={
        'original_id': 'uuid-1',
        'forgery_id': 'uuid-2'
    }
)
result = response.json()
print(f"Similarity: {result['similarity_score']}")
print(f"Is forgery: {result['is_forgery']}")
```

### JavaScript/TypeScript

```typescript
// Health check
const healthResponse = await fetch('http://localhost:8000/health');
const health = await healthResponse.json();

// Верификация
const response = await fetch('http://localhost:8000/forgery-by-id/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    original_id: 'uuid-1',
    forgery_id: 'uuid-2',
  }),
});

const result = await response.json();
console.log(`Similarity: ${result.similarity_score}`);
console.log(`Is forgery: ${result.is_forgery}`);
```

## Rate Limiting

В настоящее время rate limiting не реализован. Рекомендуется добавить его для production окружения.

## CORS

CORS настроен из `FRONTEND_URL` (значения через запятую):

- **Точный origin** — `https://your-signature-ai.vercel.app`
- **Glob с `*`** — preview Vercel, например `https://your-signature-ai-*.vercel.app` (звёздочка = любая подстрока в origin)

Локально всегда разрешены `localhost:3000` / `127.0.0.1:3000`.

## Дополнительные ресурсы

- [Управление моделями](MODEL_MANAGEMENT.md)
- [Предобработка](PREPROCESSING.md)
- [Развертывание](DEPLOYMENT.md)

