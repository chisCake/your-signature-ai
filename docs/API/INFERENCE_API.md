# Inference API

## Обзор

Inference API предоставляет endpoints для верификации подписей с использованием обученной ML модели. API построен на FastAPI и развернут на Render (рекомендуется) или Vercel serverless (альтернатива).

## Base URL

- Development: `http://localhost:8000`
- Production: `https://your-inference-api.vercel.app`

## OpenAPI документация

FastAPI автоматически генерирует OpenAPI документацию:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

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
    "architecture": "...",
    "config": {...},
    "total_parameters": 1234567,
    "trainable_parameters": 1234567
  }
}
```

### POST /forgery-by-id/

Анализ подделки по ID подписей из БД.

**Request**:
```json
{
  "original_id": "uuid",
  "forgery_id": "uuid"
}
```

**Response**:
```json
{
  "is_forgery": true,
  "similarity_score": 0.45,
  "threshold": 0.7,
  "original_id": "uuid",
  "forgery_id": "uuid",
  "error": null
}
```

### POST /forgery-by-data/

Анализ подделки по данным.

**Request** (CSV):
```json
{
  "original_id": "uuid",
  "forgery_data": "t,x,y,p\n0,100,200,0.5\n..."
}
```

**Request** (Array):
```json
{
  "original_id": "uuid",
  "forgery_data": [[0, 100, 200, 0.5], ...]
}
```

**Response**:
```json
{
  "is_forgery": true,
  "similarity_score": 0.45,
  "threshold": 0.7,
  "original_id": "uuid",
  "forgery_id": null,
  "error": null
}
```

### GET /model/info

Информация о всех моделях.

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
      "model_info": {...}
    }
  },
  "total_models": 1
}
```

### POST /model/upload

Загрузка новой модели.

**Request** (multipart/form-data):
```
model_name: string
pt_file: File
py_file: File
swap_strategy: "zero_downtime" | "sequential"
```

**Response**:
```json
{
  "success": true,
  "strategy": "zero_downtime",
  "new_model": "v2",
  "old_model": "v1",
  "message": "Model v2 activated successfully",
  "storage": {...}
}
```

### POST /model/activate

Активация модели.

**Request**:
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

### DELETE /model/delete

Удаление модели.

**Request**:
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

## Формат данных

### CSV формат подписи

```csv
t,x,y,p
0,100,200,0.5
10,105,205,0.6
20,110,210,0.7
```

### Массив данных

```json
[
  [0, 100, 200, 0.5],
  [10, 105, 205, 0.6],
  [20, 110, 210, 0.7]
]
```

## Обработка ошибок

Стандартный формат ошибки:

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

## Примеры

### cURL

```bash
# Health check
curl http://localhost:8000/health

# Верификация
curl -X POST http://localhost:8000/forgery-by-id/ \
  -H "Content-Type: application/json" \
  -d '{"original_id": "uuid", "forgery_id": "uuid"}'
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:8000/forgery-by-id/',
    json={
        'original_id': 'uuid',
        'forgery_id': 'uuid'
    }
)
result = response.json()
```

### JavaScript

```javascript
const response = await fetch('http://localhost:8000/forgery-by-id/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    original_id: 'uuid',
    forgery_id: 'uuid',
  }),
});

const result = await response.json();
```

## Дополнительные ресурсы

- [Inference документация](../inference/API.md)
- [Управление моделями](../inference/MODEL_MANAGEMENT.md)

