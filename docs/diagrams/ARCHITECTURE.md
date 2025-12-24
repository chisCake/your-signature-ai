# Architecture диаграммы

## Общая архитектура системы

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end
    
    subgraph Frontend["Frontend (Vercel)"]
        NextJS[Next.js App]
        API_Routes[API Routes]
        Components[React Components]
        Auth_Client[Supabase Auth Client]
    end
    
    subgraph Backend["Backend (Render)"]
        FastAPI[FastAPI Server]
        ModelManager[Model Manager]
        ModelLoader[Model Loader]
        Preprocessing[Preprocessing]
    end
    
    subgraph Database["Database Layer (Supabase)"]
        Postgres[(PostgreSQL)]
        Auth_DB[(Auth Database)]
        Storage[Storage Service]
    end
    
    subgraph External["External Services"]
        BlobStorage[Vercel Blob Storage]
        Colab[Google Colab]
    end
    
    Browser --> NextJS
    Mobile --> NextJS
    
    NextJS --> API_Routes
    NextJS --> Components
    NextJS --> Auth_Client
    
    API_Routes --> FastAPI
    Auth_Client --> Auth_DB
    
    FastAPI --> ModelManager
    ModelManager --> ModelLoader
    ModelLoader --> Preprocessing
    
    API_Routes --> Postgres
    FastAPI --> Postgres
    Auth_Client --> Auth_DB
    
    ModelManager --> BlobStorage
    FastAPI --> BlobStorage
    
    Colab --> Postgres
    Colab --> BlobStorage
```

## Компонентная диаграмма

```mermaid
graph LR
    subgraph FrontendComponents["Frontend Components"]
        UI[UI Components]
        Forms[Form Components]
        Signature[Signature Components]
        Layout[Layout Components]
    end
    
    subgraph BackendComponents["Backend Components"]
        Routes[API Routes]
        Utils[Utils Modules]
        Models[Model Definitions]
    end
    
    subgraph DataLayer["Data Layer"]
        DB[(Database)]
        Cache[Cache Layer]
        Storage[Blob Storage]
    end
    
    UI --> Forms
    UI --> Signature
    UI --> Layout
    
    Forms --> Routes
    Signature --> Routes
    
    Routes --> Utils
    Utils --> Models
    Utils --> DB
    
    Models --> Storage
    Routes --> Cache
    Cache --> DB
```

## Deployment архитектура

```mermaid
graph TB
    subgraph Production["Production Environment"]
        subgraph Vercel["Vercel Platform"]
            Frontend_Deploy[Frontend Deployment]
        end
        
        subgraph Render["Render Platform"]
            Backend_Deploy[Backend Web Service]
        end
        
        subgraph Supabase["Supabase Cloud"]
            Postgres_Cloud[(PostgreSQL)]
            Auth_Cloud[(Auth Service)]
            Storage_Cloud[Storage Service]
        end
        
        subgraph VercelBlob["Vercel Blob"]
            ModelStorage[Model Files Storage]
        end
    end
    
    subgraph Development["Development Environment"]
        Local_Frontend[Local Next.js Dev Server]
        Local_Backend[Local FastAPI Server]
        Local_Supabase[Local Supabase Instance]
    end
    
    subgraph Training["Training Environment"]
        Colab[Google Colab]
        Drive[Google Drive]
    end
    
    Frontend_Deploy --> Postgres_Cloud
    Backend_Deploy --> Postgres_Cloud
    Backend_Deploy --> ModelStorage
    
    Local_Frontend --> Local_Supabase
    Local_Backend --> Local_Supabase
    
    Colab --> Postgres_Cloud
    Colab --> Drive
    Colab --> ModelStorage
```

## Data Flow: Создание подписи

```mermaid
flowchart TD
    Start([Пользователь начинает рисовать]) --> Canvas[Canvas Component]
    Canvas --> Collect[Сбор точек подписи]
    Collect --> Validate[Валидация данных]
    Validate -->|Валидно| Transform[Преобразование в CSV]
    Validate -->|Невалидно| Error1[Ошибка валидации]
    Transform --> API[POST /api/signatures]
    API --> Auth[Проверка аутентификации]
    Auth -->|Успешно| Insert[INSERT INTO genuine_signatures]
    Auth -->|Ошибка| Error2[Ошибка аутентификации]
    Insert -->|Успешно| Success[Подпись сохранена]
    Insert -->|Ошибка| Error3[Ошибка БД]
    Success --> End([Завершение])
    Error1 --> End
    Error2 --> End
    Error3 --> End
```

## Data Flow: Верификация подписи

```mermaid
flowchart TD
    Start([Пользователь выбирает подписи]) --> Select[Выбор оригинальной и проверяемой]
    Select --> Request[POST /forgery-by-id]
    Request --> Fetch[Получение подписей из БД]
    Fetch --> Preprocess[Предобработка подписей]
    Preprocess --> Embed[Генерация эмбеддингов]
    Embed --> Similarity[Расчет cosine similarity]
    Similarity --> Compare[Сравнение с threshold]
    Compare -->|similarity < threshold| Forgery[Подделка]
    Compare -->|similarity >= threshold| Genuine[Подлинная]
    Forgery --> Result[Возврат результата]
    Genuine --> Result
    Result --> End([Завершение])
```

## Data Flow: Обучение модели

```mermaid
flowchart TD
    Start([Запуск обучения]) --> Config[Загрузка конфигурации]
    Config --> Fetch[Запрос подписей из БД]
    Fetch --> Filter[Фильтрация по mod_for_dataset]
    Filter --> Create[Создание LMDB датасета]
    Create --> Init[Инициализация модели]
    Init --> Loop{Эпохи обучения}
    Loop -->|Продолжить| Batch[Загрузка батча]
    Batch --> Forward[Forward pass]
    Forward --> Loss[Расчет loss]
    Loss --> Backward[Backward pass]
    Backward --> Update[Обновление весов]
    Update --> Metrics[Логирование метрик]
    Metrics --> Check{Проверка условий}
    Check -->|Продолжить| Loop
    Check -->|Остановить| Save[Сохранение checkpoint]
    Save --> Export[Экспорт модели]
    Export --> Upload[Загрузка в Blob Storage]
    Upload --> End([Завершение])
```

## Сетевая архитектура

```mermaid
graph TB
    subgraph Internet["Internet"]
        Users[Пользователи]
    end
    
    subgraph CDN["Vercel CDN"]
        Static[Static Assets]
    end
    
    subgraph VercelEdge["Vercel Edge Network"]
        EdgeFunctions[Edge Functions]
    end
    
    subgraph VercelServerless["Vercel Serverless"]
        NextJS_Functions[Next.js API Routes]
    end
    
    subgraph RenderNetwork["Render Network"]
        FastAPI_Service[FastAPI Web Service]
    end
    
    subgraph SupabaseNetwork["Supabase Network"]
        Postgres_Network[(PostgreSQL)]
        Auth_Network[(Auth)]
        Realtime[Realtime Service]
    end
    
    subgraph BlobNetwork["Vercel Blob Network"]
        Blob_Storage[Blob Storage]
    end
    
    Users --> CDN
    Users --> VercelEdge
    Users --> VercelServerless
    Users --> RenderNetwork
    
    CDN --> Static
    VercelEdge --> EdgeFunctions
    VercelServerless --> NextJS_Functions
    RenderNetwork --> FastAPI_Service
    
    NextJS_Functions --> Postgres_Network
    NextJS_Functions --> Auth_Network
    FastAPI_Service --> Postgres_Network
    FastAPI_Service --> Blob_Storage
    
    EdgeFunctions --> VercelServerless
```

## Безопасность и доступ

```mermaid
graph TB
    subgraph Security["Security Layer"]
        JWT[JWT Tokens]
        RLS[Row Level Security]
        CORS[CORS Policy]
        Validation[Input Validation]
    end
    
    subgraph Access["Access Control"]
        UserRole[User Role]
        ModRole[Mod Role]
        AdminRole[Admin Role]
        ServiceRole[Service Role]
    end
    
    subgraph Data["Data Protection"]
        Encryption[Data Encryption]
        Hashing[Token Hashing]
        SecureStorage[Secure Storage]
    end
    
    JWT --> UserRole
    JWT --> ModRole
    JWT --> AdminRole
    JWT --> ServiceRole
    
    UserRole --> RLS
    ModRole --> RLS
    AdminRole --> RLS
    ServiceRole --> RLS
    
    RLS --> Encryption
    Validation --> Hashing
    Access --> SecureStorage
```

## Масштабируемость

```mermaid
graph TB
    subgraph Horizontal["Horizontal Scaling"]
        LoadBalancer[Load Balancer]
        Instance1[Instance 1]
        Instance2[Instance 2]
        InstanceN[Instance N]
    end
    
    subgraph Vertical["Vertical Scaling"]
        ModelCache[Model Cache]
        ConnectionPool[Connection Pool]
        QueryCache[Query Cache]
    end
    
    subgraph Database["Database Scaling"]
        ReadReplicas[Read Replicas]
        WriteMaster[Write Master]
        Partitioning[Table Partitioning]
    end
    
    LoadBalancer --> Instance1
    LoadBalancer --> Instance2
    LoadBalancer --> InstanceN
    
    Instance1 --> ModelCache
    Instance2 --> ModelCache
    InstanceN --> ModelCache
    
    Instance1 --> ConnectionPool
    Instance2 --> ConnectionPool
    InstanceN --> ConnectionPool
    
    ConnectionPool --> ReadReplicas
    ConnectionPool --> WriteMaster
    
    WriteMaster --> Partitioning
    ReadReplicas --> Partitioning
```

