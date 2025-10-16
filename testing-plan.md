# План системы тестирования для vercel-site и монорепозитория

## 1. Архитектура системы тестирования

### 1.1 Основные инструменты
- **Playwright** - E2E тестирование с поддержкой параллельного запуска
- **Turborepo** - управление монорепозиторием и параллельный запуск тестов
- **Supabase SDK** - прямое взаимодействие с БД для setup/cleanup
- **dotenv** - управление переменными окружения для тестов

### 1.2 Структура тестов
```
/tests/
├── e2e/
│   ├── setup/
│   │   ├── auth.setup.ts          # Настройка авторизации
│   │   ├── database.setup.ts      # Настройка тестовой БД
│   │   └── fixtures.ts            # Общие фикстуры
│   ├── guest/                     # Тесты для неавторизованных пользователей
│   │   ├── home.spec.ts
│   │   ├── auth.spec.ts
│   │   └── forgery.spec.ts
│   ├── user/                      # Тесты для обычных пользователей
│   │   ├── dashboard.spec.ts
│   │   ├── signature-creation.spec.ts
│   │   └── privacy-settings.spec.ts
│   ├── mod/                       # Тесты для модераторов
│   │   ├── dashboard-mod.spec.ts
│   │   ├── signature-management.spec.ts
│   │   └── user-management.spec.ts
│   ├── admin/                     # Тесты для администраторов
│   │   ├── dashboard-admin.spec.ts
│   │   ├── token-management.spec.ts
│   │   └── user-creation.spec.ts
│   └── api/                       # API тесты
│       ├── auth.spec.ts
│       ├── signatures.spec.ts
│       ├── forgery.spec.ts
│       └── users.spec.ts
├── unit/                          # Unit тесты (Jest/Vitest)
│   ├── lib/
│   ├── components/
│   └── utils/
└── integration/                   # Интеграционные тесты
    ├── supabase/
    └── auth/
```

## 2. Конфигурация Playwright

### 2.1 playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
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
  globalSetup: require.resolve('./tests/e2e/setup/global.setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/setup/global.teardown.ts'),
});
```

### 2.2 Настройка авторизации (auth.setup.ts)
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

## 3. Группировка тестов по функциональности

### 3.1 Guest тесты (неавторизованные пользователи)
- Доступ к главной странице
- Функция подделки подписей
- Регистрация и вход
- Ограничения доступа к защищенным страницам

### 3.2 User тесты (обычные пользователи)
- Dashboard пользователя
- Создание и управление подписями
- Настройки приватности
- Просмотр своих подписей

### 3.3 Mod тесты (модераторы)
- Dashboard модератора
- Управление подписями пользователей
- Управление псевдопользователями
- Контролируемое добавление подписей

### 3.4 Admin тесты (администраторы)
- Dashboard администратора
- Управление токенами
- Создание пользователей
- Системные настройки

### 3.5 API тесты
- Аутентификация API
- CRUD операции с подписями
- Управление пользователями
- Валидация данных

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
    "test": "turbo run test:e2e --parallel",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:guest": "playwright test --project=guest",
    "test:user": "playwright test --project=user",
    "test:mod": "playwright test --project=mod",
    "test:admin": "playwright test --project=admin",
    "test:api": "playwright test --project=api",
    "test:setup": "playwright test --project=setup-*",
    "test:clean": "playwright test --project=cleanup"
  }
}
```

### 6.2 turbo.json
```json
{
  "pipeline": {
    "test:e2e": {
      "dependsOn": ["^build"],
      "outputs": ["test-results/**", "playwright-report/**"]
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

## 9. Расширение на другие проекты

### 9.1 Шаблон для новых проектов
- Копирование базовой структуры тестов
- Адаптация под специфику проекта
- Настройка ролей и разрешений

### 9.2 Общие утилиты
- Библиотека общих тестовых утилит
- Стандартные фикстуры
- Общие паттерны тестирования

## 10. Приоритеты реализации

1. **Фаза 1**: Базовая настройка Playwright и авторизации
2. **Фаза 2**: Guest и User тесты
3. **Фаза 3**: Mod и Admin тесты
4. **Фаза 4**: API тесты и интеграция
5. **Фаза 5**: CI/CD и мониторинг
6. **Фаза 6**: Расширение на другие проекты