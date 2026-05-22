"""
Signature CSV parsing (feature pipeline runs via bundle features.py).
"""

import csv
import logging
from io import StringIO
from typing import List, Union

import numpy as np

logger = logging.getLogger(__name__)


def parse_csv_signature_data(csv_text: str) -> np.ndarray:
    """Parse CSV with header t,x,y,p → [T, 4] float32."""
    reader = csv.reader(StringIO(csv_text.strip()))
    rows = list(reader)
    if len(rows) < 2:
        raise ValueError("CSV must have header and at least one data row")

    header = rows[0]
    t_idx = header.index("t")
    x_idx = header.index("x")
    y_idx = header.index("y")
    p_idx = header.index("p")

    data = []
    for row in rows[1:]:
        if len(row) > max(t_idx, x_idx, y_idx, p_idx):
            try:
                data.append(
                    [
                        float(row[t_idx]),
                        float(row[x_idx]),
                        float(row[y_idx]),
                        float(row[p_idx]),
                    ]
                )
            except (ValueError, IndexError):
                continue

    if not data:
        raise ValueError("No valid data rows in CSV")
    return np.array(data, dtype=np.float32)


def to_numpy_points(
    signature_data: Union[List[List[float]], np.ndarray],
) -> np.ndarray:
    if isinstance(signature_data, list):
        return np.array(signature_data, dtype=np.float32)
    return np.asarray(signature_data, dtype=np.float32)
