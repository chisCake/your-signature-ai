# Your Sign AI - Документация проекта

**Repository**: https://github.com/chisCake/your-signature-ai

## Обзор проекта

Your Sign AI - это комплексная система для сбора цифровых подписей, создания датасетов и обучения нейронных сетей для верификации подписей. Система позволяет сравнивать подписи 1 к 1 на схожесть и определять, является ли подпись подлинной или подделкой.

### Основные компоненты

Проект состоит из трех основных компонентов:

1. **Frontend (Next.js)** - веб-приложение для сбора подписей и управления системой
2. **Backend Inference (FastAPI)** - сервер для верификации подписей с использованием обученной ML модели
3. **Training (Google Colab)** - проект для обучения нейронной сети на собранных данных

### Технологический стек

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase Auth
- **Backend**: FastAPI, PyTorch, Uvicorn (развертывание на Render)
- **Database**: Supabase (PostgreSQL с расширениями)
- **Storage**: Vercel Blob Storage (для моделей в production)
- **Training**: PyTorch, Google Colab

## Быстрый старт

1. **Установка и настройка**: См. [Руководство по установке](docs/GUIDES/SETUP.md)
2. **Развертывание**: См. [Руководство по развертыванию](docs/GUIDES/DEPLOYMENT.md)
3. **Разработка**: См. [AGENTS.md](AGENTS.md) (контекст для ИИ-агентов и разработчиков)

## Навигация по документации

### Основные документы

- [Архитектура системы](docs/ARCHITECTURE.md) - общая архитектура проекта, компоненты и потоки данных
- [Схема базы данных](docs/DATABASE.md) - структура БД, таблицы, связи и RLS политики

### Документация по компонентам

#### Frontend (Next.js)
- [Обзор фронтенда](docs/frontend/README.md)
- [Компоненты](docs/frontend/COMPONENTS.md)
- [API маршруты](docs/frontend/API_ROUTES.md)
- [Аутентификация](docs/frontend/AUTHENTICATION.md)
- [Захват подписей](docs/frontend/SIGNATURE_CAPTURE.md)

#### Backend Inference (FastAPI)
- [Обзор inference сервера](docs/inference/README.md)
- [API документация](docs/inference/API.md)
- [Управление моделями](docs/inference/MODEL_MANAGEMENT.md)
- [Предобработка данных](docs/inference/PREPROCESSING.md)
- [Развертывание](docs/inference/DEPLOYMENT.md)

#### Training (Google Colab)
- [Обзор обучения](docs/training/README.md)
- [Датасет](docs/training/DATASET.md)
- [Архитектура модели](docs/training/MODEL_ARCHITECTURE.md)
- [Процесс обучения](docs/training/TRAINING_PROCESS.md)

### Диаграммы

- [Use Case диаграммы](docs/diagrams/USE_CASES.md) - сценарии использования для разных ролей
- [Sequence диаграммы](docs/diagrams/SEQUENCES.md) - последовательности взаимодействия компонентов
- [Class диаграммы](docs/diagrams/CLASSES.md) - структура классов и компонентов
- [Architecture диаграммы](docs/diagrams/ARCHITECTURE.md) - архитектурные диаграммы системы

### Руководства

- [Установка и настройка](docs/GUIDES/SETUP.md)
- [Развертывание](docs/GUIDES/DEPLOYMENT.md)
- [AGENTS.md](AGENTS.md) — контекст проекта для ИИ-агентов
- [Roadmap](docs/ROADMAP.md) — приоритеты разработки
- [Решение проблем](docs/GUIDES/TROUBLESHOOTING.md)

### API документация

- [Frontend API](docs/API/FRONTEND_API.md) - Next.js API routes
- [Inference API](docs/API/INFERENCE_API.md) - FastAPI endpoints

### Дополнительно

- [Глоссарий](docs/GLOSSARY.md) - термины и определения проекта
- [История изменений](docs/CHANGELOG.md) - версии и изменения

## Основные возможности

### Для пользователей
- Создание и сохранение цифровых подписей
- Просмотр своих подписей
- Верификация подписей (сравнение с оригиналом)

### Для модераторов
- Модерация подписей
- Управление датасетом для обучения
- Управление псевдопользователями

### Для администраторов
- Управление моделями ML
- Загрузка новых версий моделей
- Управление пользователями и ролями
- Мониторинг системы

## Архитектура вкратце

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │──────│   Supabase   │──────│  Inference  │
│  (Next.js)  │      │  (PostgreSQL) │      │  (FastAPI)  │
└─────────────┘      └──────────────┘      └─────────────┘
       │                     │                     │
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
            ┌───────────────┐  ┌──────────────┐
            │   Training    │  │ Blob Storage │
            │ (Google Colab)│  │   (Vercel)   │
            └───────────────┘  └──────────────┘
```

Подробнее см. [Архитектура системы](docs/ARCHITECTURE.md).

## Лицензия

Проект распространяется под лицензией MIT. Подробности см. в файле [LICENSE](LICENSE).

## Контакты

**Автор**: Олешкевич Кирилл

- **Email**: kirilloleshkevich7@gmail.com
- **GitHub**: [@chisCake](https://github.com/chisCake)
- **Репозиторий**: [your-signature-ai](https://github.com/chisCake/your-signature-ai)

