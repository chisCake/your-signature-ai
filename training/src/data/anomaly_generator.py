# data/anomaly_generator.py
"""
Генератор синтетических аномалий для тестирования детектора.

Все сгенерированные последовательности имеют формат [T, 4]: (t, x, y, p),
совместимый с normalize_raw_sequence() и apply_feature_pipeline() из features.py.

Использование:
    from data.anomaly_generator import AnomalyGenerator, AnomalyDataset

    gen = AnomalyGenerator(seed=42)
    seq = gen.generate("short_stroke")       # np.ndarray [T, 4]
    sequences = gen.generate_batch(100)      # список np.ndarray

    # Как PyTorch Dataset (совместим с LmdbSignatureDataset):
    dataset = AnomalyDataset(
        n_samples=500,
        max_sequence_length=1024,
        feature_pipeline=[...],  # тот же pipeline что в конфиге
    )
    tensor, mask, user_id = dataset[0]
"""

from __future__ import annotations

import math
import random
from typing import List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

from .features import apply_feature_pipeline, normalize_raw_sequence


# ---------------------------------------------------------------------------
# Типы аномалий
# ---------------------------------------------------------------------------

ANOMALY_TYPES = [
    "short_stroke",       # несколько точек — короткий штрих
    "single_point",       # одна точка (вырожденный случай)
    "random_noise",       # случайные x, y
    "circle",             # окружность
    "rectangle",          # прямоугольник
    "zigzag",             # зигзаг
    "spiral",             # спираль
    "long_random",        # очень длинная случайная траектория
    "straight_line",      # прямая горизонтальная/вертикальная/диагональная
    "dot_cluster",        # точки в маленькой области (имитирует тычок пальцем)
]


class AnomalyGenerator:
    """
    Генератор синтетических аномальных последовательностей.
    Все методы возвращают np.ndarray shape [T, 4]: (t, x, y, p).
    Координаты x, y в пикселях (ненормализованные) — normalize_raw_sequence()
    применяется внутри AnomalyDataset или вручную.
    """

    def __init__(self, seed: Optional[int] = None):
        self.rng = np.random.default_rng(seed)

    def generate(self, anomaly_type: str) -> np.ndarray:
        """Генерировать одну аномалию заданного типа."""
        generators = {
            "short_stroke":  self._short_stroke,
            "single_point":  self._single_point,
            "random_noise":  self._random_noise,
            "circle":        self._circle,
            "rectangle":     self._rectangle,
            "zigzag":        self._zigzag,
            "spiral":        self._spiral,
            "long_random":   self._long_random,
            "straight_line": self._straight_line,
            "dot_cluster":   self._dot_cluster,
        }
        if anomaly_type not in generators:
            raise ValueError(f"Unknown anomaly type: {anomaly_type}. "
                             f"Available: {list(generators.keys())}")
        return generators[anomaly_type]()

    def generate_random(self) -> Tuple[np.ndarray, str]:
        """Генерировать случайную аномалию. Возвращает (sequence, type_name)."""
        anomaly_type = self.rng.choice(ANOMALY_TYPES)
        return self.generate(anomaly_type), anomaly_type

    def generate_batch(
        self,
        n: int,
        anomaly_types: Optional[List[str]] = None,
    ) -> List[Tuple[np.ndarray, str]]:
        """
        Генерировать n аномалий. Если anomaly_types не задан — выбирает случайно.
        Возвращает список (sequence, type_name).
        """
        types = anomaly_types or ANOMALY_TYPES
        results = []
        for _ in range(n):
            t = self.rng.choice(types)
            results.append((self.generate(t), t))
        return results

    # ------------------------------------------------------------------
    # Вспомогательные методы
    # ------------------------------------------------------------------

    def _make_timestamps(self, n_points: int, duration_ms: float = 1000.0) -> np.ndarray:
        """Равномерные временные метки с небольшим шумом."""
        t = np.linspace(0, duration_ms, n_points)
        if n_points > 2:
            noise = self.rng.uniform(-2, 2, n_points)
            noise[0] = 0
            t = np.cumsum(np.maximum(np.diff(t + noise, prepend=0), 1.0))
        return t.astype(np.float32)

    def _pack(self, t, x, y, p) -> np.ndarray:
        """Собрать [T, 4] из четырёх массивов."""
        return np.stack([t, x, y, p], axis=1).astype(np.float32)

    def _const_pressure(self, n: int, value: float = 0.5) -> np.ndarray:
        return np.full(n, value, dtype=np.float32)

    def _random_pressure(self, n: int) -> np.ndarray:
        return self.rng.uniform(0.3, 1.0, n).astype(np.float32)

    # ------------------------------------------------------------------
    # Генераторы аномалий
    # ------------------------------------------------------------------

    def _short_stroke(self) -> np.ndarray:
        """5–30 точек, короткое движение в случайном направлении."""
        n = int(self.rng.integers(5, 31))
        angle = self.rng.uniform(0, 2 * math.pi)
        length = self.rng.uniform(20, 100)
        x0 = self.rng.uniform(100, 400)
        y0 = self.rng.uniform(100, 400)
        s = np.linspace(0, length, n)
        x = (x0 + s * math.cos(angle)).astype(np.float32)
        y = (y0 + s * math.sin(angle)).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=200)
        p = self._const_pressure(n, 0.7)
        return self._pack(t, x, y, p)

    def _single_point(self) -> np.ndarray:
        """1–3 точки — вырожденный случай."""
        n = int(self.rng.integers(1, 4))
        x = self.rng.uniform(50, 450, n).astype(np.float32)
        y = self.rng.uniform(50, 450, n).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=50)
        p = self._const_pressure(n, 0.8)
        return self._pack(t, x, y, p)

    def _random_noise(self) -> np.ndarray:
        """Случайные точки по всему полю."""
        n = int(self.rng.integers(30, 200))
        x = self.rng.uniform(0, 500, n).astype(np.float32)
        y = self.rng.uniform(0, 500, n).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=float(n * 10))
        p = self._random_pressure(n)
        return self._pack(t, x, y, p)

    def _circle(self) -> np.ndarray:
        """Окружность с небольшим шумом."""
        n = int(self.rng.integers(50, 150))
        cx = self.rng.uniform(150, 350)
        cy = self.rng.uniform(150, 350)
        r = self.rng.uniform(30, 150)
        angles = np.linspace(0, 2 * math.pi, n)
        noise_scale = self.rng.uniform(0, 5)
        x = (cx + r * np.cos(angles) + self.rng.normal(0, noise_scale, n)).astype(np.float32)
        y = (cy + r * np.sin(angles) + self.rng.normal(0, noise_scale, n)).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=float(n * 8))
        p = self._const_pressure(n, 0.6)
        return self._pack(t, x, y, p)

    def _rectangle(self) -> np.ndarray:
        """Прямоугольник — 4 стороны с равномерными точками."""
        pts_per_side = int(self.rng.integers(15, 50))
        x0 = self.rng.uniform(50, 200)
        y0 = self.rng.uniform(50, 200)
        w = self.rng.uniform(100, 300)
        h = self.rng.uniform(100, 300)
        sides = [
            (np.linspace(x0, x0 + w, pts_per_side), np.full(pts_per_side, y0)),
            (np.full(pts_per_side, x0 + w), np.linspace(y0, y0 + h, pts_per_side)),
            (np.linspace(x0 + w, x0, pts_per_side), np.full(pts_per_side, y0 + h)),
            (np.full(pts_per_side, x0), np.linspace(y0 + h, y0, pts_per_side)),
        ]
        x = np.concatenate([s[0] for s in sides]).astype(np.float32)
        y = np.concatenate([s[1] for s in sides]).astype(np.float32)
        n = len(x)
        t = self._make_timestamps(n, duration_ms=float(n * 8))
        p = self._const_pressure(n, 0.65)
        return self._pack(t, x, y, p)

    def _zigzag(self) -> np.ndarray:
        """Зигзаг по горизонтали."""
        n_peaks = int(self.rng.integers(3, 10))
        pts_per_seg = int(self.rng.integers(10, 30))
        amplitude = self.rng.uniform(30, 150)
        x_start = self.rng.uniform(20, 100)
        y_center = self.rng.uniform(100, 400)
        total_width = self.rng.uniform(200, 450)

        xs, ys = [], []
        for i in range(n_peaks):
            x_seg = np.linspace(
                x_start + i * total_width / n_peaks,
                x_start + (i + 1) * total_width / n_peaks,
                pts_per_seg,
            )
            y_seg = np.linspace(
                y_center + amplitude * (1 if i % 2 == 0 else -1),
                y_center + amplitude * (-1 if i % 2 == 0 else 1),
                pts_per_seg,
            )
            xs.append(x_seg)
            ys.append(y_seg)

        x = np.concatenate(xs).astype(np.float32)
        y = np.concatenate(ys).astype(np.float32)
        n = len(x)
        t = self._make_timestamps(n, duration_ms=float(n * 10))
        p = self._const_pressure(n, 0.7)
        return self._pack(t, x, y, p)

    def _spiral(self) -> np.ndarray:
        """Архимедова спираль."""
        n = int(self.rng.integers(80, 250))
        cx = self.rng.uniform(150, 350)
        cy = self.rng.uniform(150, 350)
        max_r = self.rng.uniform(80, 200)
        turns = self.rng.uniform(2, 5)
        angles = np.linspace(0, turns * 2 * math.pi, n)
        r = np.linspace(5, max_r, n)
        x = (cx + r * np.cos(angles)).astype(np.float32)
        y = (cy + r * np.sin(angles)).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=float(n * 12))
        # Давление уменьшается к концу (перо поднимается)
        p = np.linspace(0.8, 0.3, n).astype(np.float32)
        return self._pack(t, x, y, p)

    def _long_random(self) -> np.ndarray:
        """Очень длинная случайная траектория (random walk)."""
        n = int(self.rng.integers(800, 2000))
        x = np.zeros(n, dtype=np.float32)
        y = np.zeros(n, dtype=np.float32)
        x[0] = self.rng.uniform(100, 400)
        y[0] = self.rng.uniform(100, 400)
        # Random walk со смещением
        dx = self.rng.normal(0, 3, n).astype(np.float32)
        dy = self.rng.normal(0, 3, n).astype(np.float32)
        x = np.clip(np.cumsum(dx) + x[0], 0, 500).astype(np.float32)
        y = np.clip(np.cumsum(dy) + y[0], 0, 500).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=float(n * 5))
        p = self._random_pressure(n)
        return self._pack(t, x, y, p)

    def _straight_line(self) -> np.ndarray:
        """Прямая линия (горизонтальная, вертикальная или диагональная)."""
        n = int(self.rng.integers(20, 100))
        kind = self.rng.integers(0, 3)  # 0=horizontal, 1=vertical, 2=diagonal
        x0 = self.rng.uniform(50, 200)
        y0 = self.rng.uniform(50, 200)
        length = self.rng.uniform(100, 400)

        if kind == 0:
            x = np.linspace(x0, x0 + length, n).astype(np.float32)
            y = np.full(n, y0, dtype=np.float32)
        elif kind == 1:
            x = np.full(n, x0, dtype=np.float32)
            y = np.linspace(y0, y0 + length, n).astype(np.float32)
        else:
            angle = self.rng.uniform(0, 2 * math.pi)
            x = (x0 + np.linspace(0, length * math.cos(angle), n)).astype(np.float32)
            y = (y0 + np.linspace(0, length * math.sin(angle), n)).astype(np.float32)

        t = self._make_timestamps(n, duration_ms=float(n * 10))
        p = self._const_pressure(n, 0.75)
        return self._pack(t, x, y, p)

    def _dot_cluster(self) -> np.ndarray:
        """Точки в маленькой области — имитирует тычок пальцем."""
        n = int(self.rng.integers(5, 40))
        cx = self.rng.uniform(100, 400)
        cy = self.rng.uniform(100, 400)
        radius = self.rng.uniform(2, 15)  # маленький радиус
        x = (cx + self.rng.normal(0, radius, n)).astype(np.float32)
        y = (cy + self.rng.normal(0, radius, n)).astype(np.float32)
        t = self._make_timestamps(n, duration_ms=float(n * 30))
        p = self._random_pressure(n)
        return self._pack(t, x, y, p)


# ---------------------------------------------------------------------------
# PyTorch Dataset
# ---------------------------------------------------------------------------

class AnomalyDataset(Dataset):
    """
    PyTorch Dataset синтетических аномалий.
    API совместим с LmdbSignatureDataset:
        __getitem__ -> (tensor, mask, user_id)
    
    Все сэмплы генерируются один раз при инициализации и кэшируются.
    user_id = 0 для всех аномалий (класс "аномалия").

    Args:
        n_samples: Количество сэмплов
        max_sequence_length: Длина последовательности (должна совпадать с конфигом)
        feature_pipeline: Тот же pipeline что в DatasetConfig
        anomaly_types: Список типов для генерации (None = все типы равномерно)
        seed: Seed для воспроизводимости
    """

    def __init__(
        self,
        n_samples: int = 500,
        max_sequence_length: int = 1024,
        feature_pipeline: Optional[List[str]] = None,
        anomaly_types: Optional[List[str]] = None,
        seed: Optional[int] = 42,
    ):
        self.max_sequence_length = max_sequence_length
        self.feature_pipeline = feature_pipeline or ["x", "y", "p"]
        self.n_features = len(self.feature_pipeline)

        gen = AnomalyGenerator(seed=seed)
        self._samples: List[Tuple[np.ndarray, str]] = gen.generate_batch(
            n_samples, anomaly_types
        )

    def __len__(self) -> int:
        return len(self._samples)

    def __getitem__(self, index: int) -> Tuple[torch.Tensor, torch.Tensor, int]:
        raw_seq, _ = self._samples[index]  # [T, 4]: t, x, y, p

        # Нормализация координат (как в build_lmdb_dataset.py)
        raw_seq = normalize_raw_sequence(raw_seq)

        original_len = len(raw_seq)

        # Truncate / pad до max_sequence_length
        if original_len > self.max_sequence_length:
            raw_seq = raw_seq[: self.max_sequence_length]
            original_len = self.max_sequence_length
        elif original_len < self.max_sequence_length:
            pad = np.zeros(
                (self.max_sequence_length - original_len, 4), dtype=np.float32
            )
            raw_seq = np.vstack([raw_seq, pad])

        tensor = torch.from_numpy(raw_seq).float()

        # Применить feature pipeline (как в LmdbSignatureDataset)
        tensor = apply_feature_pipeline(tensor, pipeline=self.feature_pipeline)

        # Маска валидных позиций
        mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
        mask[:original_len] = True

        # user_id = 0 — все аномалии один класс
        return tensor, mask, 0

    @property
    def anomaly_type_counts(self) -> dict:
        """Статистика по типам аномалий в датасете."""
        counts: dict = {}
        for _, t in self._samples:
            counts[t] = counts.get(t, 0) + 1
        return counts


# ---------------------------------------------------------------------------
# Утилита: быстрая проверка генератора
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== AnomalyGenerator smoke test ===\n")
    gen = AnomalyGenerator(seed=0)

    for atype in ANOMALY_TYPES:
        seq = gen.generate(atype)
        print(f"  {atype:<20} shape={seq.shape}  "
              f"x=[{seq[:,1].min():.1f}, {seq[:,1].max():.1f}]  "
              f"p=[{seq[:,3].min():.2f}, {seq[:,3].max():.2f}]")

    print("\n=== AnomalyDataset smoke test ===\n")
    pipeline = [
        "x", "y", "p", "vx", "vy", "speed", "ax", "ay", "acc_norm",
        "jerk", "curvature", "log_curvature_radius", "prate",
        "abs_delta_pressure", "path_tangent_angle", "bearing_angle",
        "norm_x", "norm_y", "pen_state", "stroke_id_sin", "stroke_id_cos",
    ]
    ds = AnomalyDataset(n_samples=50, max_sequence_length=1024, feature_pipeline=pipeline)
    tensor, mask, uid = ds[0]
    print(f"  Dataset size: {len(ds)}")
    print(f"  tensor shape: {tensor.shape}")
    print(f"  mask shape:   {mask.shape}, valid={mask.sum().item()} tokens")
    print(f"  user_id:      {uid}")
    print(f"  Type counts:  {ds.anomaly_type_counts}")
    print(f"\n  NaN in tensor: {torch.isnan(tensor).any().item()}")
    print(f"  Inf in tensor: {torch.isinf(tensor).any().item()}")
    print("\nAll OK.")
