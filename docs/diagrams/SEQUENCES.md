# Sequence диаграммы

## Обзор

Sequence диаграммы описывают последовательность взаимодействий между компонентами системы при выполнении различных операций.

## Создание подписи

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Frontend as Frontend<br/>(Next.js)
    participant Canvas as Canvas Component
    participant API as Next.js API<br/>/api/signatures
    participant Auth as Supabase Auth
    participant DB as Supabase DB
    
    User->>Canvas: Рисует подпись
    Canvas->>Canvas: Собирает точки<br/>(x, y, pressure, timestamp)
    User->>Frontend: Нажимает "Сохранить"
    Frontend->>API: POST /api/signatures<br/>{ points, inputType, ... }
    API->>Auth: Проверка JWT токена
    Auth-->>API: Токен валиден
    API->>API: Валидация данных (Zod)
    API->>API: Преобразование точек в CSV
    API->>DB: INSERT INTO genuine_signatures
    DB-->>API: { id: "uuid" }
    API-->>Frontend: { id: "uuid" }
    Frontend-->>User: Подпись сохранена
```

## Верификация подписи (по ID)

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Frontend as Frontend
    participant InferenceAPI as Inference API<br/>/forgery-by-id
    participant SupabaseClient as Supabase Client
    participant DB as Supabase DB
    participant Preprocessing as Preprocessing Module
    participant ModelLoader as Model Loader
    participant Model as ML Model
    
    User->>Frontend: Выбирает оригинальную подпись
    User->>Frontend: Выбирает подпись для проверки
    Frontend->>InferenceAPI: POST /forgery-by-id<br/>{ original_id, forgery_id }
    InferenceAPI->>SupabaseClient: get_signature_data(original_id, "genuine")
    SupabaseClient->>DB: SELECT features_table FROM genuine_signatures
    DB-->>SupabaseClient: CSV данные
    SupabaseClient-->>InferenceAPI: CSV строка
    
    InferenceAPI->>SupabaseClient: get_signature_data(forgery_id, "forged")
    SupabaseClient->>DB: SELECT features_table FROM forged_signatures
    DB-->>SupabaseClient: CSV данные
    SupabaseClient-->>InferenceAPI: CSV строка
    
    InferenceAPI->>Preprocessing: preprocess_signature_data(original)
    Preprocessing-->>InferenceAPI: NumPy array
    InferenceAPI->>Preprocessing: preprocess_signature_data(forgery)
    Preprocessing-->>InferenceAPI: NumPy array
    
    InferenceAPI->>ModelLoader: encode_signature(original_tensor)
    ModelLoader->>Model: forward(original_tensor)
    Model-->>ModelLoader: embedding vector
    ModelLoader-->>InferenceAPI: original_embedding
    
    InferenceAPI->>ModelLoader: encode_signature(forgery_tensor)
    ModelLoader->>Model: forward(forgery_tensor)
    Model-->>ModelLoader: embedding vector
    ModelLoader-->>InferenceAPI: forgery_embedding
    
    InferenceAPI->>InferenceAPI: cosine_similarity(embeddings)
    InferenceAPI->>InferenceAPI: is_forgery = similarity < threshold
    InferenceAPI-->>Frontend: { similarity_score, is_forgery, threshold }
    Frontend-->>User: Результат верификации
```

## Верификация подписи (по данным)

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Frontend as Frontend
    participant Canvas as Canvas Component
    participant InferenceAPI as Inference API<br/>/forgery-by-data
    participant SupabaseClient as Supabase Client
    participant DB as Supabase DB
    participant Preprocessing as Preprocessing Module
    participant ModelLoader as Model Loader
    participant Model as ML Model
    
    User->>Frontend: Выбирает оригинальную подпись
    User->>Canvas: Рисует подпись для проверки
    Canvas->>Canvas: Собирает точки
    User->>Frontend: Нажимает "Проверить"
    Frontend->>InferenceAPI: POST /forgery-by-data<br/>{ original_id, forgery_data }
    
    InferenceAPI->>SupabaseClient: get_signature_data(original_id, "genuine")
    SupabaseClient->>DB: SELECT features_table FROM genuine_signatures
    DB-->>SupabaseClient: CSV данные
    SupabaseClient-->>InferenceAPI: CSV строка
    
    InferenceAPI->>Preprocessing: preprocess_signature_data(original)
    Preprocessing-->>InferenceAPI: NumPy array
    InferenceAPI->>Preprocessing: preprocess_signature_data(forgery_data)
    Preprocessing-->>InferenceAPI: NumPy array
    
    InferenceAPI->>ModelLoader: encode_signature(original_tensor)
    ModelLoader->>Model: forward(original_tensor)
    Model-->>ModelLoader: embedding vector
    ModelLoader-->>InferenceAPI: original_embedding
    
    InferenceAPI->>ModelLoader: encode_signature(forgery_tensor)
    ModelLoader->>Model: forward(forgery_tensor)
    Model-->>ModelLoader: embedding vector
    ModelLoader-->>InferenceAPI: forgery_embedding
    
    InferenceAPI->>InferenceAPI: cosine_similarity(embeddings)
    InferenceAPI->>InferenceAPI: is_forgery = similarity < threshold
    InferenceAPI-->>Frontend: { similarity_score, is_forgery, threshold }
    Frontend-->>User: Результат верификации
```

## Загрузка модели (Hotswap)

```mermaid
sequenceDiagram
    participant Admin as Администратор
    participant Frontend as Frontend
    participant API as Next.js API<br/>/api/admin/models/blob
    participant InferenceAPI as Inference API<br/>/model/upload
    participant ModelManager as Model Manager
    participant BlobClient as Blob Client
    participant BlobStorage as Vercel Blob Storage
    participant ModelLoader as Model Loader
    participant OldModel as Старая модель
    participant NewModel as Новая модель
    
    Admin->>Frontend: Загружает .pt и .py файлы
    Frontend->>API: POST /api/admin/models/blob<br/>{ pt_file, py_file, model_name }
    API->>API: Проверка прав администратора
    API->>BlobClient: upload_bytes(pt_file)
    BlobClient->>BlobStorage: Загрузка .pt файла
    BlobStorage-->>BlobClient: URL файла
    BlobClient-->>API: pt_download_url
    
    API->>BlobClient: upload_bytes(py_file)
    BlobClient->>BlobStorage: Загрузка .py файла
    BlobStorage-->>BlobClient: URL файла
    BlobClient-->>API: py_download_url
    
    API->>InferenceAPI: POST /model/upload<br/>{ pt_content, py_content, model_name }
    InferenceAPI->>ModelManager: upload_model(model_name, pt_content, py_content)
    
    alt Zero Downtime Strategy
        ModelManager->>ModelLoader: Load new model (old still active)
        ModelLoader->>NewModel: Initialize
        NewModel-->>ModelLoader: Model ready
        ModelManager->>ModelManager: Set new model as active
        ModelManager->>OldModel: Unload (if exists)
    else Sequential Strategy
        ModelManager->>OldModel: Unload
        ModelManager->>ModelLoader: Load new model
        ModelLoader->>NewModel: Initialize
        NewModel-->>ModelLoader: Model ready
        ModelManager->>ModelManager: Set new model as active
    end
    
    ModelManager-->>InferenceAPI: { success: true, new_model: "v2" }
    InferenceAPI-->>API: Model uploaded successfully
    API-->>Frontend: Success response
    Frontend-->>Admin: Модель загружена и активирована
```

## Обучение модели

```mermaid
sequenceDiagram
    participant Admin as Администратор
    participant Training as Training Notebook<br/>(Google Colab)
    participant SupabaseClient as Supabase Client
    participant DB as Supabase DB
    participant DataLoader as Data Loader
    participant LMDB as LMDB Dataset
    participant Model as PyTorch Model
    participant Optimizer as Optimizer
    participant LossFn as Loss Function
    
    Admin->>Training: Запускает обучение
    Training->>SupabaseClient: Запрос подписей для датасета
    SupabaseClient->>DB: SELECT * FROM genuine_signatures<br/>WHERE mod_for_dataset = true
    DB-->>SupabaseClient: Список подписей
    SupabaseClient-->>Training: Данные подписей
    
    Training->>DataLoader: Создание датасета
    DataLoader->>DataLoader: Преобразование в LMDB формат
    DataLoader->>LMDB: Сохранение данных
    LMDB-->>DataLoader: Dataset ready
    
    Training->>Model: Инициализация модели
    Model-->>Training: Model initialized
    
    loop Эпохи обучения
        Training->>DataLoader: Получить батч
        DataLoader->>LMDB: Загрузка данных
        LMDB-->>DataLoader: Батч данных
        DataLoader-->>Training: Батч тензоров
        
        Training->>Model: forward(anchor, positive, negative)
        Model-->>Training: Embeddings
        
        Training->>LossFn: triplet_loss(embeddings)
        LossFn-->>Training: Loss value
        
        Training->>Optimizer: backward()
        Optimizer->>Model: update_weights()
        
        Training->>Training: Логирование метрик
    end
    
    Training->>Training: Сохранение checkpoint
    Training->>Training: Экспорт модели (.pt и .py)
    Training-->>Admin: Обучение завершено
```

## Аутентификация пользователя

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Frontend as Frontend
    participant AuthButton as Auth Button Component
    participant SupabaseAuth as Supabase Auth Client
    participant AuthAPI as Supabase Auth API
    participant DB as Supabase DB
    
    User->>Frontend: Открывает страницу входа
    Frontend->>AuthButton: Отображение формы входа
    User->>AuthButton: Вводит email и пароль
    User->>AuthButton: Нажимает "Войти"
    
    AuthButton->>SupabaseAuth: signInWithPassword(email, password)
    SupabaseAuth->>AuthAPI: POST /auth/v1/token<br/>{ email, password }
    AuthAPI->>AuthAPI: Проверка credentials
    AuthAPI->>DB: Проверка пользователя в auth.users
    DB-->>AuthAPI: User data
    
    alt Успешная аутентификация
        AuthAPI->>AuthAPI: Генерация JWT токена
        AuthAPI->>DB: Обновление last_sign_in_at
        AuthAPI-->>SupabaseAuth: { access_token, refresh_token, user }
        SupabaseAuth->>SupabaseAuth: Сохранение токена в cookies
        SupabaseAuth-->>AuthButton: { user, session }
        AuthButton->>Frontend: Обновление состояния
        Frontend-->>User: Перенаправление на dashboard
    else Ошибка аутентификации
        AuthAPI-->>SupabaseAuth: Error
        SupabaseAuth-->>AuthButton: Error message
        AuthButton-->>User: Сообщение об ошибке
    end
```

## Создание подделки

```mermaid
sequenceDiagram
    participant User as Пользователь/Модератор
    participant Frontend as Frontend
    participant Canvas as Canvas Component
    participant API as Next.js API<br/>/api/forgery
    participant InferenceAPI as Inference API<br/>/forgery-by-data
    participant DB as Supabase DB
    participant Model as ML Model
    
    User->>Frontend: Выбирает оригинальную подпись
    Frontend->>Frontend: Отображение оригинальной подписи
    User->>Canvas: Рисует подделку
    Canvas->>Canvas: Собирает точки
    User->>Frontend: Нажимает "Сохранить подделку"
    
    Frontend->>InferenceAPI: POST /forgery-by-data<br/>{ original_id, forgery_data }
    InferenceAPI->>Model: Верификация подделки
    Model-->>InferenceAPI: similarity_score
    
    InferenceAPI-->>Frontend: { similarity_score, is_forgery }
    
    Frontend->>API: POST /api/forgery<br/>{ original_id, points, inputType, score }
    API->>API: Проверка прав (модератор или пользователь)
    API->>API: Преобразование точек в CSV
    API->>DB: INSERT INTO forged_signatures<br/>{ original_signature_id, features_table, score, ... }
    DB-->>API: { id: "uuid" }
    API-->>Frontend: { id: "uuid" }
    Frontend-->>User: Подделка сохранена
```

## Health Check

```mermaid
sequenceDiagram
    participant Monitor as Мониторинг
    participant InferenceAPI as Inference API<br/>/health
    participant SupabaseClient as Supabase Client
    participant DB as Supabase DB
    participant ModelManager as Model Manager
    participant ModelLoader as Model Loader
    
    Monitor->>InferenceAPI: GET /health
    InferenceAPI->>SupabaseClient: Проверка подключения
    SupabaseClient->>DB: SELECT 1
    DB-->>SupabaseClient: Success
    SupabaseClient-->>InferenceAPI: connected: true
    
    InferenceAPI->>ModelManager: get_active_model()
    ModelManager->>ModelLoader: Проверка состояния
    ModelLoader->>ModelLoader: is_loaded()
    ModelLoader-->>ModelManager: loaded: true
    ModelManager->>ModelLoader: get_model_info()
    ModelLoader-->>ModelManager: { path, device, architecture, ... }
    ModelManager-->>InferenceAPI: model_info
    
    InferenceAPI->>InferenceAPI: Формирование ответа
    InferenceAPI-->>Monitor: {<br/>  status: "healthy",<br/>  supabase_connected: true,<br/>  model_loaded: true,<br/>  model_info: {...}<br/>}
```

