# Детектор аномалий (Mahalanobis)

Отклоняет ввод, который **не похож на подпись** (короткий штрих, каракуля, геометрия), до сравнения с эталоном по cosine similarity.

## Пайплайн

```
Вход → SignatureEncoder → эмбеддинг → Mahalanobis → REJECT (не подпись)
                                      └→ cosine vs эталон → is_forgery
```

Энкодер **не переобучается**. Детектор строится на замороженных эмбеддингах после обучения.

## Обучение / калибровка

### Автоматически (`TrainingRunner`)

После цикла эпох, на `best_by_eer.pt`:

1. **fit** — эмбеддинги **genuine** из **train** (без аугментаций, полный проход по split)
2. **threshold** — перцентиль Mahalanobis на **genuine val** (`anomaly_percentile`, по умолчанию 99)
3. **оценка** — синтетические «не-подписи» (`anomaly_synthetic_n`, см. `data/anomaly_generator.py`)
4. Артефакты в run_dir:
   - `anomaly_params.npz` — `mean`, `cov_inv`, `threshold`
   - `logs/anomaly_eval.json` — метрики для manifest

### Конфиг (`TrainingConfig` в `config.py`)

| Поле | По умолчанию | Смысл |
|------|----------------|-------|
| `anomaly_enabled` | `true` | Калибровка в конце `runner.run()` |
| `anomaly_include_in_bundle` | `true` | Требовать npz при export zip |
| `anomaly_percentile` | `99.0` | Порог по val genuine |
| `anomaly_synthetic_n` | `500` | Размер синтетического набора для отчёта |
| `anomaly_min_samples` | `256` | Минимум точек для fit |

### Notebook (перекалибровка)

Ячейка **«Детектор аномалий»**:

```python
NAME = ''              # при REEXPORT_BUNDLE — имя zip/manifest
RUN_DIR = ''
ANOMALY_PERCENTILE = ''  # пусто → из configs.json
REEXPORT_BUNDLE = True
```

`calibrate_anomaly_detector(run_dir)` — код в `training/src/training/anomaly_calibration.py`.

## Inference

- `ModelLoader` загружает `AnomalyDetector` из `anomaly_params.npz`, если `manifest.anomaly.enabled`.
- `utils/forgery_analysis.verify_embeddings` проверяет **кандидата** (в `forgery-by-data` — нарисованный штрих; в `forgery-by-id` — вторая подпись).

### Ответ API (доп. поля)

| Поле | Описание |
|------|----------|
| `is_not_signature` | `true` — отклонён детектором |
| `rejection_reason` | `"input_not_a_signature"` |
| `anomaly_score` | Mahalanobis distance |
| `anomaly_threshold` | Порог из bundle |

При reject: `similarity_score=0`, `is_forgery=true` (для единообразия UI); фронт показывает «Ввод не похож на подпись» (`formatForgeryResult`).

## Почему не отдельная голова в сети

Joint BCE + triplet требует размеченных негативов и рискует деградировать верификацию. Mahalanobis добавляется поверх готового энкодера без смены архитектуры.

## См. также

- [Model bundle](MODEL_BUNDLE.md)
- [Inference API — forgery](../API/INFERENCE_API.md)
- Исходный план: [roadmap/roadmap_anomaly_detection.md](../roadmap/roadmap_anomaly_detection.md)
