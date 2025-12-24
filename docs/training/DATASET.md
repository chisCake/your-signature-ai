# Датасет

## Обзор

Датасет создается из подписей, хранящихся в Supabase, и преобразуется в формат LMDB для эффективной загрузки во время обучения.

## Структура данных

### Исходные данные

Подписи хранятся в Supabase в таблице `genuine_signatures` и `forged_signatures` в формате CSV:

```csv
t,x,y,p
0,100,200,0.5
10,105,205,0.6
20,110,210,0.7
...
```

### LMDB формат

LMDB (Lightning Memory-Mapped Database) используется для быстрой загрузки данных:

- Ключ: ID подписи
- Значение: Сериализованные данные подписи

## Создание датасета

### Шаг 1: Загрузка данных из Supabase

```python
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Загрузка подлинных подписей
genuine_signatures = supabase.table('genuine_signatures')\
    .select('*')\
    .eq('mod_for_dataset', True)\
    .execute()

# Загрузка поддельных подписей
forged_signatures = supabase.table('forged_signatures')\
    .select('*')\
    .eq('mod_for_dataset', True)\
    .execute()
```

### Шаг 2: Фильтрация

Фильтрация по типу ввода (если необходимо):

```python
if INPUT_TYPE != 'any':
    genuine_signatures = [s for s in genuine_signatures 
                         if s['input_type'] == INPUT_TYPE]
    forged_signatures = [s for s in forged_signatures 
                        if s['input_type'] == INPUT_TYPE]
```

### Шаг 3: Создание LMDB

```python
import lmdb
import pickle

env = lmdb.open(LMDB_PATH, map_size=1099511627776)  # 1TB

with env.begin(write=True) as txn:
    for signature in all_signatures:
        key = signature['id'].encode()
        value = pickle.dumps({
            'features': parse_csv(signature['features_table']),
            'user_id': signature['user_id'],
            'type': 'genuine' or 'forged'
        })
        txn.put(key, value)
```

### Шаг 4: Создание mapping файла

JSON файл для соответствия ID подписи и записи в БД:

```json
{
  "signature_id_1": {
    "user_id": "user_id_1",
    "type": "genuine",
    "input_type": "mouse"
  },
  ...
}
```

## Загрузка данных

### LMDB Dataset

```python
class LMDBDataset(Dataset):
    def __init__(self, lmdb_path, mapping_path, transform=None):
        self.env = lmdb.open(lmdb_path, readonly=True)
        with open(mapping_path) as f:
            self.mapping = json.load(f)
        self.keys = list(self.mapping.keys())
        self.transform = transform
    
    def __getitem__(self, idx):
        key = self.keys[idx]
        with self.env.begin() as txn:
            value = txn.get(key.encode())
            data = pickle.loads(value)
        
        features = data['features']
        if self.transform:
            features = self.transform(features)
        
        return features, data['user_id']
```

## Аугментация

Аугментация данных применяется во время обучения для увеличения разнообразия данных.

### Типы аугментации

1. **Time Warp** - Искажение временной шкалы
2. **Noise** - Добавление шума
3. **Rotation** - Поворот подписи
4. **Scale** - Масштабирование
5. **Dropout** - Удаление случайных точек
6. **Time Resample** - Передискретизация
7. **Pressure Variation** - Изменение давления

### Конфигурация

```python
@dataclass
class AugmentationConfig:
    time_warp_prob: float = 0.5
    time_warp_sigma: float = 0.3
    noise_prob: float = 0.5
    noise_sigma: float = 0.02
    rotation_prob: float = 0.3
    rotation_range: float = 8.0
    scale_prob: float = 0.3
    scale_range: List[float] = [0.85, 1.15]
    dropout_prob: float = 0.2
    dropout_rate: float = 0.1
```

## PK Sampling

PK Sampler обеспечивает сбалансированную выборку:
- P пользователей в батче
- K подписей от каждого пользователя

Это гарантирует наличие положительных и отрицательных примеров в каждом батче.

## Разделение данных

### По пользователям (split_by_users=True)

- Train: 70% пользователей
- Validation: 15% пользователей
- Test: 15% пользователей

Пользователи не пересекаются между наборами.

### По подписям (split_by_users=False)

- Train: 70% подписей каждого пользователя
- Validation: 15% подписей каждого пользователя
- Test: 15% подписей каждого пользователя

## Дополнительные ресурсы

- [Архитектура модели](MODEL_ARCHITECTURE.md)
- [Процесс обучения](TRAINING_PROCESS.md)

