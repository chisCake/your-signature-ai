# Frontend API

## Обзор

Frontend API состоит из Next.js API Routes, которые предоставляют серверные endpoints для работы с данными и выполнения операций, требующих серверной логики.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://your-app.vercel.app`

## Аутентификация

Все endpoints (кроме `/api/health`) требуют аутентификации через Supabase Auth. JWT токен передается через cookies.

## Endpoints

### Signatures

#### POST `/api/signatures`

Создание новой подписи.

**Request**:
```typescript
{
  points: Array<{
    timestamp: number;
    x: number;
    y: number;
    pressure: number;
  }>;
  inputType: 'mouse' | 'touch' | 'pen';
  userForForgery?: boolean;
  targetTable?: 'profiles' | 'pseudousers';
  targetId?: string; // UUID
}
```

**Response**:
```typescript
{
  id: string; // UUID новой подписи
}
```

**Status Codes**:
- `200` - Подпись создана
- `401` - Не авторизован
- `400` - Ошибка валидации
- `500` - Ошибка сервера

#### PATCH `/api/signatures`

Массовое обновление флагов подписей пользователя.

**Request**:
```typescript
{
  userId?: string; // Опционально, для модераторов
  userForForgery?: boolean;
  modForForgery?: boolean; // Только для модераторов
  modForDataset?: boolean; // Только для модераторов
}
```

**Response**:
```typescript
{
  success: true;
  user_for_forgery?: boolean;
  mod_for_forgery?: boolean;
  mod_for_dataset?: boolean;
}
```

#### GET `/api/signatures/[id]`

Получение информации о подписи.

**Response**:
```typescript
{
  id: string;
  user_id?: string;
  pseudouser_id?: string;
  features_table: string;
  input_type?: 'mouse' | 'touch' | 'pen';
  user_for_forgery: boolean;
  mod_for_forgery: boolean;
  mod_for_dataset: boolean;
  name?: string;
  created_at: string;
  updated_at: string;
}
```

### Forgery

#### POST `/api/forgery`

Создание поддельной подписи.

**Request**:
```typescript
{
  original_id: string; // UUID оригинальной подписи
  points: Array<SignaturePoint>;
  inputType: 'mouse' | 'touch' | 'pen';
  score?: number; // Оценка от inference API
}
```

**Response**:
```typescript
{
  id: string; // UUID новой подделки
}
```

#### GET `/api/forgery/[id]`

Получение информации о подделке.

**Response**:
```typescript
{
  id: string;
  original_signature_id?: string;
  original_user_id?: string;
  original_pseudouser_id?: string;
  features_table: string;
  input_type?: 'mouse' | 'touch' | 'pen';
  mod_for_dataset: boolean;
  score?: number;
  model_id?: string;
  forger_id?: string;
  name?: string;
  created_at: string;
  updated_at: string;
}
```

### Users

#### GET `/api/users/[id]`

Получение информации о пользователе.

**Response**:
```typescript
{
  id: string;
  role: 'user' | 'mod' | 'admin';
  display_name: string;
  created_at: string;
  updated_at: string;
  email?: string;
}
```

### Admin

#### POST `/api/admin/models/blob`

Загрузка новой модели (только для администраторов).

**Request** (multipart/form-data):
```
model_name: string
pt_file: File
py_file: File
```

**Response**:
```typescript
{
  success: true;
  model_name: string;
  storage: {
    type: 'blob';
    pt_blob_path: string;
    py_blob_path: string;
    pt_download_url: string;
    py_download_url: string;
  };
}
```

### Health

#### GET `/api/health`

Проверка состояния API.

**Response**:
```typescript
{
  status: 'ok';
  timestamp: string;
}
```

## Типы данных

### SignaturePoint

```typescript
interface SignaturePoint {
  timestamp: number;
  x: number;
  y: number;
  pressure: number;
  tilt?: number;
  azimuth?: number;
  acceleration?: {
    x: number;
    y: number;
    z: number;
  };
  velocity?: {
    x: number;
    y: number;
  };
}
```

## Обработка ошибок

Все endpoints возвращают стандартный формат ошибки:

```typescript
{
  error: string;
  details?: any;
}
```

### Статус коды

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Ошибка валидации
- `401` - Не авторизован
- `403` - Недостаточно прав
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

## Примеры использования

### Создание подписи

```typescript
const response = await fetch('/api/signatures', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    points: signaturePoints,
    inputType: 'mouse',
    userForForgery: false,
  }),
});

const { id } = await response.json();
```

### Получение подписи

```typescript
const response = await fetch(`/api/signatures/${signatureId}`);
const signature = await response.json();
```

### Загрузка модели (админ)

```typescript
const formData = new FormData();
formData.append('pt_file', ptFile);
formData.append('py_file', pyFile);
formData.append('model_name', 'v2');

const response = await fetch('/api/admin/models/blob', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

## Дополнительные ресурсы

- [Frontend документация](../frontend/API_ROUTES.md)
- [Inference API](INFERENCE_API.md)

