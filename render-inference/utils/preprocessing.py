"""
Утилиты для предобработки данных подписей
"""

import numpy as np
import torch
from typing import List, Dict, Any, Union
import logging

logger = logging.getLogger(__name__)


def v1_preprocess_signature_data(
    signature_data: Union[List[List[float]], np.ndarray, torch.Tensor]
) -> np.ndarray:
    """
    Предобработка данных подписи для модели SignatureEncoder v1
    
    Входные данные: [t, x, y, p] - могут быть не нормализованы
    Выходные данные: ["x", "y", "p", "t", "vx", "vy", "ax", "ay", "prate", "path_tangent_angle", "abs_delta_pressure"] (11 признаков)
    
    Args:
        signature_data: Данные подписи в формате [[t1, x1, y1, p1], [t2, x2, y2, p2], ...]
        
    Returns:
        np.ndarray: Предобработанные данные готовые для модели [T, 11]
    """
    try:
        # Преобразование в numpy array
        if isinstance(signature_data, torch.Tensor):
            data = signature_data.detach().cpu().numpy()
        elif isinstance(signature_data, list):
            data = np.array(signature_data, dtype=np.float32)
        else:
            data = np.array(signature_data, dtype=np.float32)
        
        if data.shape[1] < 4:
            raise ValueError(f"Expected at least 4 columns [t, x, y, p], got {data.shape[1]}")
        
        # Извлечение базовых координат
        t = data[:, 0]
        x = data[:, 1]
        y = data[:, 2]
        p = data[:, 3]
        
        # Нормализация координат с сохранением пропорций x/y
        x_min, x_max = x.min(), x.max()
        y_min, y_max = y.min(), y.max()
        p_min, p_max = p.min(), p.max()
        
        # Нормализация x,y с сохранением пропорций
        x_range = x_max - x_min
        y_range = y_max - y_min
        max_range = max(x_range, y_range)
        
        if max_range == 0:
            max_range = 1.0  # Избегаем деления на ноль
        
        # Нормализованные координаты
        x_norm = (x - x_min) / max_range
        y_norm = (y - y_min) / max_range
        
        # Нормализация давления независимо
        p_range = p_max - p_min
        if p_range == 0:
            p_range = 1.0
        p_norm = (p - p_min) / p_range
        
        # Нормализация времени
        t_range = t.max() - t.min()
        if t_range == 0:
            t_range = 1.0
        t_norm = (t - t.min()) / t_range
        
        # Вычисление производных времени
        dt = np.zeros_like(t_norm)
        if len(t_norm) > 1:
            dt[1:] = np.diff(t_norm)
            # Минимальный шаг времени для стабильности
            dt = np.maximum(dt, 1e-6)
        
        # Вычисление скорости
        dx = np.zeros_like(x_norm)
        dy = np.zeros_like(y_norm)
        if len(x_norm) > 1:
            dx[1:] = np.diff(x_norm)
            dy[1:] = np.diff(y_norm)
        
        vx = _safe_div(dx, dt)
        vy = _safe_div(dy, dt)
        
        # Вычисление ускорения
        dvx = np.zeros_like(vx)
        dvy = np.zeros_like(vy)
        if len(vx) > 1:
            dvx[1:] = np.diff(vx)
            dvy[1:] = np.diff(vy)
        
        ax = _safe_div(dvx, dt)
        ay = _safe_div(dvy, dt)
        
        # Вычисление производной давления (prate)
        dp = np.zeros_like(p_norm)
        if len(p_norm) > 1:
            dp[1:] = np.diff(p_norm)
        
        prate = _safe_div(dp, dt)
        
        # Вычисление угла касательной к пути
        path_tangent_angle = np.zeros_like(vx)
        mask = (vx != 0) | (vy != 0)
        path_tangent_angle[mask] = np.arctan2(vy[mask], vx[mask]) / np.pi
        
        # Абсолютное изменение давления
        abs_delta_pressure = np.abs(np.diff(p_norm, prepend=p_norm[0]))
        
        # Обрезка экстремальных значений
        vx = _clip_extreme_values(vx)
        vy = _clip_extreme_values(vy)
        ax = _clip_extreme_values(ax)
        ay = _clip_extreme_values(ay)
        prate = _clip_extreme_values(prate)
        path_tangent_angle = _clip_extreme_values(path_tangent_angle)
        abs_delta_pressure = _clip_extreme_values(abs_delta_pressure)
        
        # Замена NaN/Inf на нули
        vx = np.nan_to_num(vx, nan=0.0, posinf=0.0, neginf=0.0)
        vy = np.nan_to_num(vy, nan=0.0, posinf=0.0, neginf=0.0)
        ax = np.nan_to_num(ax, nan=0.0, posinf=0.0, neginf=0.0)
        ay = np.nan_to_num(ay, nan=0.0, posinf=0.0, neginf=0.0)
        prate = np.nan_to_num(prate, nan=0.0, posinf=0.0, neginf=0.0)
        path_tangent_angle = np.nan_to_num(path_tangent_angle, nan=0.0, posinf=0.0, neginf=0.0)
        abs_delta_pressure = np.nan_to_num(abs_delta_pressure, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Сборка финального массива в нужном порядке
        processed_data = np.column_stack([
            x_norm,                    # "x"
            y_norm,                    # "y"
            p_norm,                    # "p"
            t_norm,                    # "t"
            vx,                        # "vx"
            vy,                        # "vy"
            ax,                        # "ax"
            ay,                        # "ay"
            prate,                     # "prate"
            path_tangent_angle,        # "path_tangent_angle"
            abs_delta_pressure         # "abs_delta_pressure"
        ])
        
        # Финальная проверка на NaN/Inf
        if np.isnan(processed_data).any() or np.isinf(processed_data).any():
            logger.warning("NaN/Inf detected in processed data. Replacing with zeros.")
            processed_data = np.nan_to_num(processed_data, nan=0.0, posinf=0.0, neginf=0.0)
        
        logger.debug(f"Processed signature data shape: {processed_data.shape}")
        return processed_data.astype(np.float32)
        
    except Exception as e:
        logger.error(f"Error preprocessing signature data: {e}")
        raise


def _safe_div(a: np.ndarray, b: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """Безопасное деление с обработкой экстремальных значений"""
    b_clipped = np.maximum(b, eps)
    result = a / b_clipped
    result = np.clip(result, -1e4, 1e4)
    return result


def _clip_extreme_values(arr: np.ndarray, max_abs_value: float = 1e6) -> np.ndarray:
    """Обрезка экстремальных значений для предотвращения NaN/Inf"""
    return np.clip(arr, -max_abs_value, max_abs_value)


def parse_csv_signature_data(csv_text: str) -> np.ndarray:
    """
    Парсинг CSV данных подписи
    
    Args:
        csv_text: CSV текст с заголовками и данными
        
    Returns:
        np.ndarray: Данные в формате [t, x, y, p]
    """
    import csv
    from io import StringIO
    
    try:
        reader = csv.reader(StringIO(csv_text.strip()))
        rows = list(reader)
        
        if len(rows) < 2:
            raise ValueError("CSV must have at least header and one data row")
        
        header = rows[0]
        data_rows = rows[1:]
        
        # Поиск индексов колонок
        try:
            t_idx = header.index('t')
            x_idx = header.index('x')
            y_idx = header.index('y')
            p_idx = header.index('p')
        except ValueError as e:
            raise ValueError(f"Required columns not found in CSV header: {e}")
        
        # Извлечение данных
        data = []
        for row in data_rows:
            if len(row) > max(t_idx, x_idx, y_idx, p_idx):
                try:
                    t_val = float(row[t_idx])
                    x_val = float(row[x_idx])
                    y_val = float(row[y_idx])
                    p_val = float(row[p_idx])
                    data.append([t_val, x_val, y_val, p_val])
                except (ValueError, IndexError):
                    continue
        
        if not data:
            raise ValueError("No valid data rows found in CSV")
        
        return np.array(data, dtype=np.float32)
        
    except Exception as e:
        logger.error(f"Error parsing CSV signature data: {e}")
        raise
