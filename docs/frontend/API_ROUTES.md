# Frontend API Routes

## Обзор

Next.js API Routes предоставляют серверные endpoints для работы с данными и выполнения операций, требующих серверной логики.

## Структура

Все API routes находятся в `app/api/` и используют Next.js App Router.

## Endpoints

### Signatures

#### POST `/api/signatures`

Создание новой подписи.

**Request Body**:
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

**Ошибки**:
- `401` - Не авторизован
- `400` - Валидация не прошла
- `500` - Ошибка БД

#### PATCH `/api/signatures`

Массовое обновление флагов подписей пользователя.

**Request Body**:
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

Получение информации о подписи по ID.

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

**Request Body**:
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

Получение информации о подделке по ID.

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

**Ошибки**:
- `401` - Не авторизован
- `403` - Недостаточно прав
- `404` - Пользователь не найден

### Admin

#### POST `/api/admin/models/blob`

Загрузка новой модели (только для администраторов).

**Request Body**:
```typescript
{
  model_name: string;
  pt_file: File; // .pt файл модели
  py_file: File; // .py файл с определением модели
}
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

**Ошибки**:
- `401` - Не авторизован
- `403` - Не администратор
- `400` - Неверный формат файлов
- `500` - Ошибка загрузки

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

### Inference

#### GET `/api/inference/model`

Получение информации о текущей модели на inference сервере.

**Response**:
```typescript
{
  active_model: string;
  models: {
    [model_name: string]: {
      name: string;
      state: 'loading' | 'ready' | 'active' | 'unloading' | 'error';
      is_active: boolean;
      is_ready: boolean;
      error?: string;
      model_info?: {
        path: string;
        device: string;
        architecture: string;
        config: object;
      };
    };
  };
}
```

## Аутентификация

Все API routes (кроме `/api/health`) требуют аутентификации. Используется Supabase Auth через server-side клиент.

### Проверка аутентификации

```typescript
import { getUser } from '@/lib/utils/auth-server-utils';

export async function GET() {
  const user = await getUser();
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // ... логика
}
```

### Проверка ролей

```typescript
import { isMod, isAdmin } from '@/lib/utils/auth-server-utils';

export async function POST() {
  const user = await getUser();
  
  if (!(await isAdmin(user))) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  
  // ... логика для администратора
}
```

## Валидация

Все входные данные валидируются с помощью Zod.

### Пример валидации

```typescript
import { z } from 'zod';

const bodySchema = z.object({
  points: z.array(
    z.object({
      timestamp: z.number(),
      x: z.number(),
      y: z.number(),
      pressure: z.number(),
    })
  ).min(1),
  inputType: z.enum(['mouse', 'touch', 'pen']),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parse = bodySchema.safeParse(json);
  
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.errors },
      { status: 400 }
    );
  }
  
  const { points, inputType } = parse.data;
  // ... обработка
}
```

## Обработка ошибок

Все API routes должны обрабатывать ошибки и возвращать понятные сообщения.

### Стандартный формат ошибки

```typescript
{
  error: string;
  details?: any; // Дополнительная информация
}
```

### HTTP статусы

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Ошибка валидации
- `401` - Не авторизован
- `403` - Недостаточно прав
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

## Service Client

Для работы с Supabase используется service role client для операций, требующих повышенных прав.

```typescript
import { createServiceClient } from '@/lib/supabase/service';

const supabaseSR = createServiceClient();
// Использование для операций, требующих service role
```

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

- [Аутентификация](AUTHENTICATION.md)
- [Захват подписей](SIGNATURE_CAPTURE.md)
- [Inference API](../API/INFERENCE_API.md)

