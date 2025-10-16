# План системы тестирования для монорепозитория

## 1. Архитектура системы тестирования

### 1.1 Основные инструменты
- **Playwright** - E2E тестирование для веб-приложений (vercel-site, render-site)
- **Pytest** - тестирование Python скриптов (colab-training, render-site)
- **Turborepo** - управление монорепозиторием и параллельный запуск тестов
- **Supabase SDK** - прямое взаимодействие с БД для setup/cleanup
- **dotenv** - управление переменными окружения для тестов

### 1.2 Структура тестов по проектам
```
/tests/
├── vercel-site/                   # Тесты для Next.js приложения
│   ├── e2e/
│   │   ├── setup/
│   │   │   ├── auth.setup.ts      # Настройка авторизации
│   │   │   ├── database.setup.ts  # Настройка тестовой БД
│   │   │   └── fixtures.ts        # Общие фикстуры
│   │   ├── guest/                 # Тесты для неавторизованных пользователей
│   │   │   ├── home.spec.ts
│   │   │   ├── auth.spec.ts
│   │   │   └── forgery.spec.ts
│   │   ├── user/                  # Тесты для обычных пользователей
│   │   │   ├── dashboard.spec.ts
│   │   │   ├── signature-creation.spec.ts
│   │   │   └── privacy-settings.spec.ts
│   │   ├── mod/                   # Тесты для модераторов
│   │   │   ├── dashboard-mod.spec.ts
│   │   │   ├── signature-management.spec.ts
│   │   │   └── user-management.spec.ts
│   │   ├── admin/                 # Тесты для администраторов
│   │   │   ├── dashboard-admin.spec.ts
│   │   │   ├── token-management.spec.ts
│   │   │   └── user-creation.spec.ts
│   │   └── api/                   # API тесты
│   │       ├── auth.spec.ts
│   │       ├── signatures.spec.ts
│   │       ├── forgery.spec.ts
│   │       └── users.spec.ts
│   ├── unit/                      # Unit тесты (Jest/Vitest)
│   │   ├── lib/
│   │   ├── components/
│   │   └── utils/
│   └── integration/               # Интеграционные тесты
│       ├── supabase/
│       └── auth/
├── colab-training/                # Тесты для Python скриптов обучения
│   ├── unit/                      # Unit тесты (pytest)
│   │   ├── test_compile_md.py
│   │   ├── test_copy_test_users.py
│   │   └── test_fullname_generator.py
│   ├── integration/               # Интеграционные тесты
│   │   ├── test_training_pipeline.py
│   │   └── test_data_processing.py
│   └── e2e/                       # End-to-end тесты обучения
│       ├── test_model_training.py
│       └── test_data_generation.py
└── render-site/                   # Тесты для Python веб-приложения
    ├── unit/                      # Unit тесты (pytest)
    │   ├── test_api_endpoints.py
    │   ├── test_models.py
    │   └── test_utils.py
    ├── integration/               # Интеграционные тесты
    │   ├── test_database.py
    │   └── test_auth.py
    └── e2e/                       # E2E тесты (Playwright + Python)
        ├── test_web_interface.py
        └── test_user_flows.py
```

## 2. Конфигурация тестирования по проектам

### 2.1 vercel-site/playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/vercel-site/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Setup проекты
    {
      name: 'setup-admin',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'setup-mod',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'setup-user',
      testMatch: /.*\.setup\.ts/,
    },
    // Основные группы тестов
    {
      name: 'guest',
      testMatch: /.*\.guest\.spec\.ts/,
      dependencies: [],
    },
    {
      name: 'user',
      testMatch: /.*\.user\.spec\.ts/,
      dependencies: ['setup-user'],
      use: {
        storageState: 'storage/user-auth.json',
      },
    },
    {
      name: 'mod',
      testMatch: /.*\.mod\.spec\.ts/,
      dependencies: ['setup-mod'],
      use: {
        storageState: 'storage/mod-auth.json',
      },
    },
    {
      name: 'admin',
      testMatch: /.*\.admin\.spec\.ts/,
      dependencies: ['setup-admin'],
      use: {
        storageState: 'storage/admin-auth.json',
      },
    },
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      dependencies: [],
    },
  ],
  globalSetup: require.resolve('./tests/vercel-site/e2e/setup/global.setup.ts'),
  globalTeardown: require.resolve('./tests/vercel-site/e2e/setup/global.teardown.ts'),
});
```

### 2.2 colab-training/pytest.ini
```ini
[tool:pytest]
testpaths = tests/colab-training
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    --cov=colab
    --cov-report=html
    --cov-report=term-missing
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    slow: Slow running tests
```

### 2.3 render-site/pytest.ini
```ini
[tool:pytest]
testpaths = tests/render-site
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    --cov=render_site
    --cov-report=html
    --cov-report=term-missing
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    slow: Slow running tests
```

### 2.4 render-site/playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/render-site/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8000', // Предполагаемый порт для render-site
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'web-interface',
      testMatch: /.*\.web\.spec\.ts/,
    },
    {
      name: 'user-flows',
      testMatch: /.*\.flow\.spec\.ts/,
    },
  ],
  globalSetup: require.resolve('./tests/render-site/e2e/setup/global.setup.ts'),
  globalTeardown: require.resolve('./tests/render-site/e2e/setup/global.teardown.ts'),
});
```

### 2.5 Настройка авторизации для vercel-site (auth.setup.ts)
```typescript
import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin'
  },
  mod: {
    email: 'mod@test.com', 
    password: 'mod123',
    role: 'mod'
  },
  user: {
    email: 'user@test.com',
    password: 'user123',
    role: 'user'
  }
};

setup('authenticate admin', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email"]', testUsers.admin.email);
  await page.fill('[data-testid="password"]', testUsers.admin.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard-admin');
  await page.context().storageState({ path: 'storage/admin-auth.json' });
});

setup('authenticate mod', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email"]', testUsers.mod.email);
  await page.fill('[data-testid="password"]', testUsers.mod.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard-mod');
  await page.context().storageState({ path: 'storage/mod-auth.json' });
});

setup('authenticate user', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email"]', testUsers.user.email);
  await page.fill('[data-testid="password"]', testUsers.user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: 'storage/user-auth.json' });
});
```

## 3. Группировка тестов по проектам и функциональности

### 3.1 vercel-site тесты

#### 3.1.1 Guest тесты (неавторизованные пользователи)
- Доступ к главной странице
- Функция подделки подписей
- Регистрация и вход
- Ограничения доступа к защищенным страницам

#### 3.1.2 User тесты (обычные пользователи)
- Dashboard пользователя
- Создание и управление подписями
- Настройки приватности
- Просмотр своих подписей

#### 3.1.3 Mod тесты (модераторы)
- Dashboard модератора
- Управление подписями пользователей
- Управление псевдопользователями
- Контролируемое добавление подписей

#### 3.1.4 Admin тесты (администраторы)
- Dashboard администратора
- Управление токенами
- Создание пользователей
- Системные настройки

#### 3.1.5 API тесты
- Аутентификация API
- CRUD операции с подписями
- Управление пользователями
- Валидация данных

### 3.2 colab-training тесты

#### 3.2.1 Unit тесты (Python скрипты)
- `test_compile_md.py` - тестирование компиляции markdown
- `test_copy_test_users.py` - тестирование копирования тестовых пользователей
- `test_fullname_generator.py` - тестирование генератора имен
- `test_controller.py` - тестирование контроллера
- `test_server.py` - тестирование сервера

#### 3.2.2 Integration тесты
- `test_training_pipeline.py` - тестирование пайплайна обучения
- `test_data_processing.py` - тестирование обработки данных
- `test_model_validation.py` - тестирование валидации моделей

#### 3.2.3 E2E тесты
- `test_model_training.py` - полный цикл обучения модели
- `test_data_generation.py` - генерация тестовых данных
- `test_colab_integration.py` - интеграция с Google Colab

### 3.3 render-site тесты

#### 3.3.1 Unit тесты (Python API)
- `test_api_endpoints.py` - тестирование API эндпоинтов
- `test_models.py` - тестирование моделей данных
- `test_utils.py` - тестирование утилит
- `test_auth.py` - тестирование аутентификации

#### 3.3.2 Integration тесты
- `test_database.py` - тестирование работы с БД
- `test_auth_flow.py` - тестирование потока аутентификации
- `test_api_integration.py` - интеграция API компонентов

#### 3.3.3 E2E тесты (Playwright + Python)
- `test_web_interface.py` - тестирование веб-интерфейса
- `test_user_flows.py` - тестирование пользовательских сценариев
- `test_api_workflows.py` - тестирование API рабочих процессов
- Валидация результатов обучения

### 3.3 render-site тесты

#### 3.3.1 Unit тесты (pytest)
- Тестирование API endpoints
- Валидация моделей данных
- Тестирование бизнес-логики
- Проверка утилит

#### 3.3.2 Integration тесты
- Тестирование работы с БД
- Интеграция с внешними API
- Тестирование аутентификации

#### 3.3.3 E2E тесты (Playwright + Python)
- Тестирование веб-интерфейса
- Пользовательские сценарии
- Кроссбраузерное тестирование

## 4. Система очистки данных

### 4.1 Глобальная очистка (global.teardown.ts)
```typescript
import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Очистка тестовых данных
  await supabase.from('forged_signatures').delete().like('forger_id', 'test-%');
  await supabase.from('genuine_signatures').delete().like('user_id', 'test-%');
  await supabase.from('profiles').delete().like('email', '%@test.com');
  await supabase.from('pseudousers').delete().like('source', 'test');
}
```

### 4.2 Локальная очистка (afterAll хуки)
```typescript
test.afterAll(async () => {
  // Очистка данных, созданных в конкретном тесте
  if (createdSignatureId) {
    await deleteTestSignature(createdSignatureId);
  }
  if (createdUserId) {
    await deleteTestUser(createdUserId);
  }
});
```

## 5. Управление зависимостями тестов

### 5.1 Последовательные тесты
```typescript
test.describe.configure({ mode: 'serial' });

test.describe('Admin User Management Flow', () => {
  let createdUserId: string;

  test('create user', async ({ page }) => {
    // Создание пользователя
    createdUserId = await createTestUser();
  });

  test('edit user', async ({ page }) => {
    // Редактирование созданного пользователя
    expect(createdUserId).toBeDefined();
  });

  test.afterAll(async () => {
    // Очистка после всех тестов в группе
    if (createdUserId) {
      await deleteTestUser(createdUserId);
    }
  });
});
```

### 5.2 Параллельные тесты с изоляцией
```typescript
test.describe('Signature Management', () => {
  test('create signature', async ({ page }) => {
    // Изолированный тест создания подписи
  });

  test('view signatures', async ({ page }) => {
    // Изолированный тест просмотра подписей
  });
});
```

## 6. Скрипты запуска тестов

### 6.1 package.json (корень монорепозитория)
```json
{
  "scripts": {
    "test": "turbo run test --parallel",
    "test:vercel-site": "turbo run test --filter=vercel-site",
    "test:colab-training": "turbo run test --filter=colab-training", 
    "test:render-site": "turbo run test --filter=render-site",
    "test:vercel-site:e2e": "cd vercel-site && playwright test",
    "test:vercel-site:unit": "cd vercel-site && npm run test:unit",
    "test:colab-training:unit": "cd colab-training && pytest tests/colab-training/unit",
    "test:colab-training:integration": "cd colab-training && pytest tests/colab-training/integration",
    "test:colab-training:e2e": "cd colab-training && pytest tests/colab-training/e2e",
    "test:render-site:unit": "cd render-site && pytest tests/render-site/unit",
    "test:render-site:integration": "cd render-site && pytest tests/render-site/integration",
    "test:render-site:e2e": "cd render-site && playwright test",
    "test:ui": "turbo run test:ui --parallel",
    "test:debug": "turbo run test:debug --parallel"
  }
}
```

### 6.2 vercel-site/package.json
```json
{
  "scripts": {
    "test": "playwright test",
    "test:unit": "jest",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "test:guest": "playwright test --project=guest",
    "test:user": "playwright test --project=user",
    "test:mod": "playwright test --project=mod",
    "test:admin": "playwright test --project=admin",
    "test:api": "playwright test --project=api"
  }
}
```

### 6.3 colab-training/requirements-test.txt
```txt
pytest>=7.0.0
pytest-cov>=4.0.0
pytest-mock>=3.10.0
pytest-asyncio>=0.21.0
pytest-xdist>=3.0.0
```

### 6.4 render-site/requirements-test.txt
```txt
pytest>=7.0.0
pytest-cov>=4.0.0
pytest-mock>=3.10.0
pytest-asyncio>=0.21.0
pytest-xdist>=3.0.0
playwright>=1.40.0
```

### 6.2 vercel-site/package.json
```json
{
  "scripts": {
    "test": "playwright test",
    "test:unit": "jest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:guest": "playwright test --project=guest",
    "test:user": "playwright test --project=user",
    "test:mod": "playwright test --project=mod",
    "test:admin": "playwright test --project=admin",
    "test:api": "playwright test --project=api"
  }
}
```

### 6.3 colab-training/package.json
```json
{
  "scripts": {
    "test": "pytest",
    "test:unit": "pytest -m unit",
    "test:integration": "pytest -m integration",
    "test:e2e": "pytest -m e2e",
    "test:cov": "pytest --cov=colab --cov-report=html",
    "test:slow": "pytest -m slow"
  }
}
```

### 6.4 render-site/package.json
```json
{
  "scripts": {
    "test": "pytest && playwright test",
    "test:unit": "pytest -m unit",
    "test:integration": "pytest -m integration", 
    "test:e2e": "playwright test",
    "test:python": "pytest",
    "test:web": "playwright test",
    "test:cov": "pytest --cov=render_site --cov-report=html"
  }
}
```

### 6.5 turbo.json
```json
{
  "pipeline": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["test-results/**", "playwright-report/**", "coverage/**"]
    },
    "test:unit": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["^build"],
      "outputs": ["test-results/**", "playwright-report/**"]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "outputs": ["test-results/**"]
    }
  }
}
```

## 7. CI/CD интеграция

### 7.1 GitHub Actions
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 8. Мониторинг и отчетность

### 8.1 Отчеты
- HTML отчеты Playwright
- Интеграция с Allure для детальных отчетов
- Уведомления о падении тестов

### 8.2 Метрики
- Время выполнения тестов
- Процент успешности
- Покрытие функциональности

## 9. Управление тестами по проектам

### 9.1 vercel-site (Next.js + Supabase)
- **Технологии**: Playwright, Jest, Supabase SDK
- **Особенности**: E2E тесты с авторизацией, API тесты, тесты компонентов
- **Запуск**: `npm run test:vercel-site`

### 9.2 colab-training (Python скрипты)
- **Технологии**: pytest, pytest-cov, pytest-mock
- **Особенности**: Unit тесты Python скриптов, интеграционные тесты пайплайнов
- **Запуск**: `npm run test:colab-training`

### 9.3 render-site (Python веб-приложение)
- **Технологии**: pytest, Playwright, FastAPI/Flask тестирование
- **Особенности**: API тесты, E2E тесты веб-интерфейса
- **Запуск**: `npm run test:render-site`

### 9.4 Общие тестовые утилиты
```
/tests/
├── shared/
│   ├── fixtures/
│   │   ├── auth.ts              # Общие фикстуры авторизации
│   │   ├── database.ts          # Фикстуры для работы с БД
│   │   └── data-generators.ts   # Генераторы тестовых данных
│   ├── utils/
│   │   ├── supabase.ts          # Утилиты для работы с Supabase
│   │   ├── playwright.ts        # Утилиты для Playwright
│   │   └── pytest.ts            # Утилиты для pytest
│   └── config/
│       ├── base-playwright.config.ts
│       ├── base-pytest.ini
│       └── test-env.ts
```

### 9.5 Стандартные паттерны тестирования
- Единообразная структура тестовых файлов
- Стандартизированные data-testid атрибуты
- Общие паттерны для setup/teardown
- Унифицированная система отчетности

## 10. Приоритеты реализации

### 10.1 Фаза 1: vercel-site (базовая функциональность)
1. Настройка Playwright для vercel-site
2. Создание системы авторизации
3. Guest и User тесты
4. Базовая система очистки данных

### 10.2 Фаза 2: vercel-site (расширенная функциональность)
1. Mod и Admin тесты
2. API тесты
3. Интеграционные тесты
4. CI/CD настройка

### 10.3 Фаза 3: colab-training
1. Настройка pytest для Python скриптов
2. Unit тесты для compile_md.py, copy_test_users.py, fullname_generator.py
3. Integration тесты для пайплайна обучения
4. E2E тесты для полного цикла обучения

### 10.4 Фаза 4: render-site
1. Настройка pytest для Python веб-приложения
2. Unit тесты для API эндпоинтов и моделей
3. Integration тесты для работы с БД
4. E2E тесты с Playwright для веб-интерфейса

### 10.5 Фаза 5: Интеграция и мониторинг
1. Настройка CI/CD для всех проектов
2. Общие утилиты и шаблоны
3. Мониторинг и отчетность
4. Документация и обучение
4. E2E тесты обучения

### 10.4 Фаза 4: render-site
1. Настройка pytest + Playwright
2. Unit тесты для Python кода
3. E2E тесты веб-интерфейса
4. Интеграционные тесты

### 10.5 Фаза 5: Общие улучшения
1. Общие утилиты и шаблоны
2. Мониторинг и отчетность
3. Оптимизация производительности
4. Документация