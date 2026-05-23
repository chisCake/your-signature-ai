# Training (Google Colab) - Документация

## Обзор

Training проект Your Sign AI предназначен для обучения нейронных сетей на собранных данных подписей. Проект выполняется в Google Colab и использует PyTorch для обучения моделей.

## Структура проекта

```
training/
├── main.ipynb              # Рабочий notebook (gitignored, Colab)
├── main.example.ipynb      # В репозитории; npm run notebook:main-to-example
├── requirements.txt
└── src/
    ├── config.py           # Dataset / Model / TrainingConfig (+ anomaly_*)
    ├── models/             # SignatureEncoder (hybrid)
    ├── training/           # TrainingRunner, export_bundle, anomaly_calibration
    └── data/               # LMDB, features.py, anomaly_generator
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
2. Добавьте секрет `YSAI_PROJECT` с путем к папке проекта

### 3. Переменные окружения

Настройте секреты в Colab:

- `YSAI_SUPABASE_URL` - URL вашего Supabase проекта
- `YSAI_SUPABASE_PUBLISHABLE_KEY` - Публичный ключ Supabase
- `YSAI_EMAIL` - Email для входа
- `YSAI_PASSWORD` - Пароль для входа
- `YSAI_DATASET_PATH` (опционально) - путь к датасету без расширения `.lmdb` / `.json`

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

1. **Загрузка данных** — Supabase → LMDB (`build_lmdb_dataset`)
2. **Обучение** — `TrainingRunner` (triplet, PK-sampling, EER на val)
3. **Калибровка anomaly** — Mahalanobis на frozen embeddings (если `anomaly_enabled`)
4. **Экспорт bundle** — `{NAME}.zip` с `manifest.json`, `weights.pt`, `encoder.py`, `features.py`

Ячейки notebook: обучение → (опционально) перекалибровка anomaly → ручной export с `NAME`.

## Метрики

Во время обучения отслеживаются:
- Loss (training и validation)
- EER (Equal Error Rate)
- Accuracy
- Precision/Recall

## Экспорт модели

**Model bundle zip** для inference — см. [MODEL_BUNDLE.md](MODEL_BUNDLE.md):

- В ячейке export: `NAME = 'sig-v4'` задаёт имя zip и `manifest.bundle_name`
- Порог верификации (cosine) и anomaly — в `manifest.json`

## Дополнительные ресурсы

- [Датасет](DATASET.md)
- [Архитектура модели](MODEL_ARCHITECTURE.md)
- [Процесс обучения](TRAINING_PROCESS.md)
- [Model bundle](MODEL_BUNDLE.md)
- [Детектор аномалий](ANOMALY_DETECTION.md)

