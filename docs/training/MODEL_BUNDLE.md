# Model bundle (zip для inference)

После обучения артефакты run-папки упаковываются в **`{NAME}.zip`** и загружаются в Blob как `models/{NAME}.zip`, затем активируются в `inference/models/current/`.

## Содержимое zip

| Файл | Назначение |
|------|------------|
| `manifest.json` | Метаданные: pipeline, пороги, anomaly, `bundle_name` |
| `weights.pt` | Checkpoint `best_by_eer.pt` |
| `encoder.py` | Копия `model.py` из run (класс `SignatureEncoder`) |
| `features.py` | Пайплайн признаков (из `training/src/data/features.py`) |
| `configs.json` | Снимок конфигов эксперимента |
| `anomaly_params.npz` | Опционально: mean, `cov_inv`, threshold (если anomaly включён) |
| `metrics/`, `plots/` | Опционально: логи и графики обучения |

В архиве **ровно один** `manifest.json` (сначала упаковывается payload, затем manifest добавляется с финальным `bundle_sha256`).

### `bundle_sha256` в manifest

- Это SHA256 **payload-части** zip (все файлы **кроме** `manifest.json`).
- SHA256 **целого** загруженного zip при upload пишется отдельно в таблицу `models` (`model_manager.upload_bundle_zip`).

## `manifest.json` (schema_version 1)

Обязательные поля:

- `feature_pipeline`, `in_features`, `verification.threshold` (cosine, EER на val)
- `model.*` — размерности энкодера

Опциональный блок **`anomaly`** (если калибровка выполнена и `anomaly_include_in_bundle: true`):

```json
"anomaly": {
  "enabled": true,
  "metric": "mahalanobis",
  "threshold": 37.05,
  "calibration_percentile": 99.0,
  "val_pass_rate": 0.99,
  "synthetic_reject_rate": 0.0,
  "files": { "params": "anomaly_params.npz" }
}
```

Старые bundle без `anomaly` остаются валидными: inference пропускает проверку аномалий.

## Автоматический экспорт

В конце `TrainingRunner.run()`:

1. Финальный test eval
2. Калибровка Mahalanobis (если `anomaly_enabled`)
3. `export_model_bundle` → `{run_name}.zip` в папке run

Имя zip по умолчанию = **имя папки run** (timestamp или `run_name` из `TrainingConfig`).

## Ручной экспорт (notebook)

Ячейка **«Сборка model bundle»** в `training/main.example.ipynb`:

```python
NAME = ''    # имя модели / bundle / zip без .zip, напр. sig-v4
RUN_DIR = '' # пусто → последний exportable run под OUTPUT_DIR
```

- `NAME = 'sig-v4'` → файл `sig-v4.zip`, в manifest `bundle_name: "sig-v4"`.
- `NAME` пустой → используется имя каталога run (например `20260523_085221`).

Код:

```python
from training.export_bundle import export_bundle_from_run, resolve_latest_run_dir

bundle_name = NAME.strip() if NAME and str(NAME).strip() else run_path.name
zip_path = export_bundle_from_run(str(run_path), bundle_name=bundle_name)
```

### Требования к run для export

- `checkpoints/best_by_eer.pt`, `model.py`
- При `anomaly_include_in_bundle: true` (дефолт): `anomaly_params.npz` и `logs/anomaly_eval.json`

Пересборка только anomaly: ячейка **«Детектор аномалий»** с `REEXPORT_BUNDLE=True` и тем же `NAME`.

## Код

- `training/src/training/export_bundle.py` — `export_model_bundle`, `build_manifest`
- `training/src/training/runner.py` — `_try_export_bundle`
- `inference/utils/bundle.py` — валидация при unpack

## См. также

- [Детектор аномалий](ANOMALY_DETECTION.md)
- [Процесс обучения](TRAINING_PROCESS.md)
- [Управление моделями на inference](../inference/MODEL_MANAGEMENT.md)
