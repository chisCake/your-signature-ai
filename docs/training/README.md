# Training (Google Colab) - Документация

## Обзор

Training проект Your Sign AI предназначен для обучения нейронных сетей на собранных данных подписей. Проект выполняется в Google Colab и использует PyTorch для обучения моделей.

## Структура проекта

```
training/
├── main.ipynb              # Рабочий notebook (gitignored, Colab)
├── main.example.ipynb      # В репозитории: без outputs; npm run notebook:sync
├── requirements.txt        # Зависимости Python
└── src/                    # Исходный код
    ├── config.py          # Конфигурация обучения
    ├── models/            # Архитектуры моделей
    │   └── signature_encoder.py
    ├── training/           # Логика обучения
    │   ├── trainer.py
    │   ├── loss.py
    │   └── metrics.py
    ├── data/              # Загрузка данных
    │   └── dataset.py
    └── utils/             # Утилиты
```

## Требования

- Google Colab аккаунт
- Доступ к Google Drive
- Supabase credentials

## Настройка окружения

### 1. Подключение Google Drive

В первой ячейке notebook:

```python
from google.colab import drive
drive.mount('/content/drive')
```

### 2. Настройка путей

Установите переменную `PROJECT`:

```python
PROJECT = '/content/drive/MyDrive/your-signature-ai/training'
```

Или через Secrets:

1. Перейдите в Secrets (🔑) в боковой панели
2. Добавьте секрет `PROJECT` с путем к папке проекта

### 3. Переменные окружения

Настройте секреты в Colab:

- `SUPABASE_URL` - URL вашего Supabase проекта
- `SUPABASE_PUBLISHABLE_KEY` - Публичный ключ Supabase
- `EMAIL` - Email для входа
- `PASSWORD` - Пароль для входа

### 4. Установка зависимостей

```bash
!pip install -r requirements.txt
```

## Основные компоненты

### Конфигурация

Конфигурация обучения находится в `src/config.py`:

- **DatasetConfig** - Настройки датасета
- **ModelConfig** - Настройки модели
- **TrainingConfig** - Настройки обучения
- **ExperimentConfig** - Общая конфигурация эксперимента

### Датасет

Датасет создается из подписей в Supabase и сохраняется в формате LMDB для эффективной загрузки.

### Модель

Архитектура модели определена в `src/models/signature_encoder.py`. Модель состоит из:
- CNN слоев для извлечения признаков
- BiGRU для обработки последовательностей
- Attention механизма
- Fully connected слоя для эмбеддингов

### Обучение

Процесс обучения включает:
- Загрузку данных
- Forward pass
- Вычисление loss
- Backward pass
- Обновление весов

## Процесс обучения

1. **Загрузка данных** - Получение подписей из Supabase
2. **Создание датасета** - Преобразование в LMDB формат
3. **Инициализация модели** - Создание экземпляра модели
4. **Обучение** - Цикл обучения на эпохах
5. **Валидация** - Оценка на валидационном наборе
6. **Сохранение** - Сохранение checkpoint и экспорт модели

## Метрики

Во время обучения отслеживаются:
- Loss (training и validation)
- EER (Equal Error Rate)
- Accuracy
- Precision/Recall

## Экспорт модели

После обучения модель экспортируется в два файла:
- `.pt` - Веса модели (PyTorch checkpoint)
- `.py` - Определение архитектуры (для inference)

## Дополнительные ресурсы

- [Датасет](DATASET.md)
- [Архитектура модели](MODEL_ARCHITECTURE.md)
- [Процесс обучения](TRAINING_PROCESS.md)

