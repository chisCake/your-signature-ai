# Your Sign AI - Документация проекта

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

1. **Установка и настройка**: См. [Руководство по установке](GUIDES/SETUP.md)
2. **Развертывание**: См. [Руководство по развертыванию](GUIDES/DEPLOYMENT.md)
3. **Разработка**: См. [Руководство для разработчиков](GUIDES/CONTRIBUTING.md)

## Навигация по документации

### Основные документы

- [Архитектура системы](ARCHITECTURE.md) - общая архитектура проекта, компоненты и потоки данных
- [Схема базы данных](DATABASE.md) - структура БД, таблицы, связи и RLS политики

### Документация по компонентам

#### Frontend (Next.js)
- [Обзор фронтенда](frontend/README.md)
- [Компоненты](frontend/COMPONENTS.md)
- [API маршруты](frontend/API_ROUTES.md)
- [Аутентификация](frontend/AUTHENTICATION.md)
- [Захват подписей](frontend/SIGNATURE_CAPTURE.md)

#### Backend Inference (FastAPI)
- [Обзор inference сервера](inference/README.md)
- [API документация](inference/API.md)
- [Управление моделями](inference/MODEL_MANAGEMENT.md)
- [Предобработка данных](inference/PREPROCESSING.md)
- [Развертывание](inference/DEPLOYMENT.md)

#### Training (Google Colab)
- [Обзор обучения](training/README.md)
- [Датасет](training/DATASET.md)
- [Архитектура модели](training/MODEL_ARCHITECTURE.md)
- [Процесс обучения](training/TRAINING_PROCESS.md)

### Диаграммы

- [Use Case диаграммы](diagrams/USE_CASES.md) - сценарии использования для разных ролей
- [Sequence диаграммы](diagrams/SEQUENCES.md) - последовательности взаимодействия компонентов
- [Class диаграммы](diagrams/CLASSES.md) - структура классов и компонентов
- [Architecture диаграммы](diagrams/ARCHITECTURE.md) - архитектурные диаграммы системы

### Руководства

- [Установка и настройка](GUIDES/SETUP.md)
- [Развертывание](GUIDES/DEPLOYMENT.md)
- [Руководство для разработчиков](GUIDES/CONTRIBUTING.md)
- [Решение проблем](GUIDES/TROUBLESHOOTING.md)

### API документация

- [Frontend API](API/FRONTEND_API.md) - Next.js API routes
- [Inference API](API/INFERENCE_API.md) - FastAPI endpoints

### Дополнительно

- [Глоссарий](GLOSSARY.md) - термины и определения проекта
- [История изменений](CHANGELOG.md) - версии и изменения

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

Подробнее см. [Архитектура системы](ARCHITECTURE.md).

## Лицензия

[Указать лицензию проекта]

## Контакты

[Контактная информация]

