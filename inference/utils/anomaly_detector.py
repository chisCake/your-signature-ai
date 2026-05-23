"""Mahalanobis anomaly detector loaded from bundle npz."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from scipy.spatial.distance import mahalanobis


class AnomalyDetector:
    def __init__(
        self,
        mean: np.ndarray,
        cov_inv: np.ndarray,
        threshold: float,
        calibration_percentile: float = 99.0,
    ) -> None:
        self.mean = mean
        self.cov_inv = cov_inv
        self.threshold = float(threshold)
        self.calibration_percentile = float(calibration_percentile)

    def score(self, embedding: np.ndarray) -> float:
        x = np.asarray(embedding, dtype=np.float64).reshape(-1)
        return float(mahalanobis(x, self.mean, self.cov_inv))

    def is_anomaly(self, embedding: np.ndarray) -> bool:
        return self.score(embedding) > self.threshold

    @classmethod
    def from_npz(
        cls, path: str | Path, manifest_section: Optional[Dict[str, Any]] = None
    ) -> "AnomalyDetector":
        data = np.load(path)
        threshold = float(data["threshold"])
        if manifest_section and "threshold" in manifest_section:
            threshold = float(manifest_section["threshold"])
        cal = float(data["calibration_percentile"]) if "calibration_percentile" in data else 99.0
        if manifest_section and "calibration_percentile" in manifest_section:
            cal = float(manifest_section["calibration_percentile"])
        return cls(
            mean=data["mean"],
            cov_inv=data["cov_inv"],
            threshold=threshold,
            calibration_percentile=cal,
        )
