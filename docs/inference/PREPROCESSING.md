# Предобработка данных

## Обзор

Модуль предобработки преобразует сырые данные подписей (CSV или массив точек) в формат, пригодный для обработки ML моделью. Предобработка включает нормализацию, извлечение признаков и преобразование в тензоры.

## Входные данные

### CSV формат

```csv
t,x,y,p
0,100,200,0.5
10,105,205,0.6
20,110,210,0.7
...
```

### Массив данных

```python
[
  [0, 100, 200, 0.5],
  [10, 105, 205, 0.6],
  [20, 110, 210, 0.7]
]
```

## Процесс предобработки

### Шаг 1: Парсинг данных

```python
def _parse_csv_data(csv_string: str) -> np.ndarray:
    """Парсинг CSV строки в numpy array"""
    lines = csv_string.strip().split('\n')
    # Пропуск заголовка
    data_lines = lines[1:] if len(lines) > 1 else lines
    # Парсинг данных
    data = []
    for line in data_lines:
        values = line.split(',')
        data.append([float(v) for v in values])
    return np.array(data, dtype=np.float32)
```

### Шаг 2: Извлечение базовых признаков

```python
t = data[:, 0]  # Время
x = data[:, 1]  # X координата
y = data[:, 2]  # Y координата
p = data[:, 3]  # Давление
```

### Шаг 3: Нормализация координат

Координаты нормализуются с сохранением пропорций:

```python
x_min, x_max = x.min(), x.max()
y_min, y_max = y.min(), y.max()
max_range = max(x_max - x_min, y_max - y_min)

if max_range == 0:
    max_range = 1.0

x_norm = (x - x_min) / max_range
y_norm = (y - y_min) / max_range
```

### Шаг 4: Нормализация давления и времени

```python
p_min, p_max = p.min(), p.max()
p_range = p_max - p_min if p_max != p_min else 1.0
p_norm = (p - p_min) / p_range

t_range = t.max() - t.min() if t.max() != t.min() else 1.0
t_norm = (t - t.min()) / t_range
```

### Шаг 5: Вычисление производных

#### Скорость

```python
dx = np.diff(x_norm)
dy = np.diff(y_norm)
dt = np.diff(t_norm)
dt = np.maximum(dt, 1e-6)  # Избегаем деления на ноль

vx = dx / dt
vy = dy / dt
```

#### Ускорение

```python
dvx = np.diff(vx)
dvy = np.diff(vy)
dt_acc = dt[1:] if len(dt) > 1 else dt

ax = dvx / dt_acc
ay = dvy / dt_acc
```

### Шаг 6: Дополнительные признаки

#### Скорость (magnitude)

```python
speed = np.sqrt(vx**2 + vy**2)
```

#### Норма ускорения

```python
acc_norm = np.sqrt(ax**2 + ay**2)
```

#### Изменение давления

```python
dp = np.diff(p_norm)
prate = dp / dt
abs_delta_pressure = np.abs(dp)
```

#### Углы

```python
path_tangent_angle = np.arctan2(dy, dx)
bearing_angle = np.arctan2(y_norm, x_norm)
```

## Выходные данные

### Для модели v1

11 признаков:
1. `x` - Нормализованная X координата
2. `y` - Нормализованная Y координата
3. `p` - Нормализованное давление
4. `t` - Нормализованное время
5. `vx` - Скорость по X
6. `vy` - Скорость по Y
7. `ax` - Ускорение по X
8. `ay` - Ускорение по Y
9. `prate` - Скорость изменения давления
10. `path_tangent_angle` - Угол касательной к пути
11. `abs_delta_pressure` - Абсолютное изменение давления

### Формат тензора

```python
# Форма: [1, T, 11]
# Где T - длина последовательности
tensor = torch.from_numpy(features).float().unsqueeze(0)
```

## Версии предобработки

### v1_preprocess_signature_data

Предобработка для модели SignatureEncoder v1.

**Вход**: `[t, x, y, p]`
**Выход**: `[x, y, p, t, vx, vy, ax, ay, prate, path_tangent_angle, abs_delta_pressure]`

### v2_preprocess_signature_data

Предобработка для модели SignatureEncoder v2 (если отличается).

## Обработка граничных случаев

### Пустая подпись

```python
if len(data) == 0:
    raise ValueError("Signature data is empty")
```

### Одна точка

```python
if len(data) == 1:
    # Дублируем точку для вычисления производных
    data = np.vstack([data, data])
```

### Деление на ноль

```python
def _safe_div(numerator, denominator, default=0.0):
    """Безопасное деление с обработкой нуля"""
    with np.errstate(divide='ignore', invalid='ignore'):
        result = np.divide(numerator, denominator)
        result = np.nan_to_num(result, nan=default, posinf=default, neginf=default)
    return result
```

### Нулевой диапазон

```python
if max_range == 0:
    max_range = 1.0  # Избегаем деления на ноль
    x_norm = np.zeros_like(x)
    y_norm = np.zeros_like(y)
```

## Оптимизация

### Векторизация

Все операции выполняются с использованием NumPy для векторизации:

```python
# Вместо циклов
vx = np.diff(x_norm) / np.diff(t_norm)
```

### Память

Используется `float32` вместо `float64` для экономии памяти:

```python
data = np.array(data, dtype=np.float32)
```

## Валидация

### Проверка формата

```python
if data.shape[1] < 4:
    raise ValueError(
        f"Expected at least 4 columns [t, x, y, p], got {data.shape[1]}"
    )
```

### Проверка данных

```python
if np.any(np.isnan(data)) or np.any(np.isinf(data)):
    raise ValueError("Signature data contains NaN or Inf values")
```

## Использование

### В API endpoint

```python
from utils.preprocessing import preprocess_signature_data

# Получение данных из БД
signature_data = supabase_client.get_signature_data(signature_id, "genuine")

# Предобработка
features = preprocess_signature_data(signature_data, model_version="v1")

# Преобразование в тензор
tensor = torch.from_numpy(features).float().unsqueeze(0)

# Inference
embedding = model_loader.encode_signature(tensor)
```

## Дополнительные ресурсы

- [API документация](API.md)
- [Управление моделями](MODEL_MANAGEMENT.md)
- [Training предобработка](../training/DATASET.md)

