# Frontend (Next.js) - Документация

## Обзор

Frontend приложение Your Sign AI построено на Next.js 16 с использованием App Router, React 19, TypeScript и Tailwind CSS. Приложение предоставляет интерфейс для сбора подписей, их просмотра, верификации и управления системой.

## Структура проекта

```
site/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Страницы аутентификации
│   ├── dashboard/         # Дашборды для разных ролей
│   ├── signatures/        # Страницы подписей
│   └── layout.tsx         # Корневой layout
├── components/            # React компоненты
│   ├── auth/             # Компоненты аутентификации
│   ├── signature/         # Компоненты для работы с подписями
│   ├── dashboard/         # Компоненты дашборда
│   ├── layout/            # Layout компоненты
│   └── ui/                # UI компоненты (Radix UI)
├── lib/                   # Утилиты и клиенты
│   ├── supabase/         # Supabase клиенты и queries
│   ├── hooks/             # React hooks
│   ├── utils/             # Утилиты
│   └── types.ts           # TypeScript типы
└── tests/                 # Тесты
```

## Технологии

### Основные
- **Next.js 16** - React framework с App Router
- **React 19** - UI библиотека
- **TypeScript** - Типизация
- **Tailwind CSS** - Стилизация

### UI библиотеки
- **Radix UI** - Доступные UI компоненты
- **Lucide React** - Иконки
- **next-themes** - Управление темами

### Аутентификация и данные
- **Supabase Auth** - Аутентификация
- **Supabase Client** - Работа с БД
- **@supabase/ssr** - SSR поддержка для Supabase

### Утилиты
- **Zod** - Валидация схем
- **date-fns** - Работа с датами
- **class-variance-authority** - Управление классами CSS

## Основные функции

### Для пользователей
- Регистрация и вход в систему
- Создание цифровых подписей через Canvas
- Просмотр своих подписей
- Верификация подписей (сравнение с оригиналом)
- Управление профилем

### Для модераторов
- Все функции пользователя
- Просмотр всех подписей
- Модерация подписей
- Управление флагами для датасета
- Управление псевдопользователями

### Для администраторов
- Все функции модератора
- Управление ML моделями
- Загрузка новых моделей
- Управление пользователями и ролями
- Мониторинг системы

## Компоненты

Подробнее см. [Компоненты](COMPONENTS.md)

### Основные группы компонентов

1. **Signature Components** - Работа с подписями
   - `Canvas` - Компонент для рисования подписей
   - `SignatureModal` - Модальное окно для просмотра/создания
   - `SignatureList` - Список подписей
   - `SignatureView` - Просмотр отдельной подписи

2. **Auth Components** - Аутентификация
   - `AuthButton` - Кнопка входа/выхода
   - `LoginForm` - Форма входа
   - `SignUpForm` - Форма регистрации

3. **Dashboard Components** - Дашборды
   - `DashboardList` - Навигация дашборда
   - `DashboardSection` - Секции дашборда

4. **UI Components** - Базовые UI компоненты
   - Компоненты из Radix UI
   - Кастомные компоненты (Button, Card, Input и т.д.)

## API Routes

Подробнее см. [API Routes](API_ROUTES.md)

### Основные endpoints

- `/api/signatures` - Управление подписями
- `/api/forgery` - Создание подделок
- `/api/users` - Управление пользователями
- `/api/admin/models/blob` - Управление моделями (админы)

## Аутентификация

Подробнее см. [Аутентификация](AUTHENTICATION.md)

Система использует Supabase Auth для аутентификации пользователей. Поддерживаются:
- Регистрация с email/password
- Вход с email/password
- Восстановление пароля
- JWT токены для авторизации

## Захват подписей

Подробнее см. [Захват подписей](SIGNATURE_CAPTURE.md)

Canvas компонент позволяет пользователям рисовать подписи с помощью:
- Мыши
- Сенсорного экрана
- Графического планшета

Данные собираются в формате точек с координатами, давлением и временными метками.

## Разработка

### Установка зависимостей

```bash
cd site
npm install
```

### Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

### Сборка для production

```bash
npm run build
npm start
```

### Тестирование

```bash
# Unit тесты
npm test

# E2E тесты
npm run test:e2e

# Покрытие кода
npm run test:coverage
```

## Переменные окружения

Создайте файл `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_INFERENCE_URL=http://localhost:8000
```

## Дополнительные ресурсы

- [Компоненты](COMPONENTS.md)
- [API Routes](API_ROUTES.md)
- [Аутентификация](AUTHENTICATION.md)
- [Захват подписей](SIGNATURE_CAPTURE.md)
- [Архитектура системы](../ARCHITECTURE.md)

