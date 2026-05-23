"""Mahalanobis distance anomaly detector on signature embeddings."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
from scipy.spatial.distance import mahalanobis


class MahalanobisAnomalyDetector:
    """Unsupervised detector: far from train embedding cloud => anomaly."""

    def __init__(self) -> None:
        self.mean: Optional[np.ndarray] = None
        self.cov_inv: Optional[np.ndarray] = None
        self.threshold: Optional[float] = None
        self.calibration_percentile: Optional[float] = None

    def fit(self, train_embeddings: np.ndarray) -> None:
        """Fit mean and inverse covariance from (N, D) train embeddings."""
        if train_embeddings.ndim != 2:
            raise ValueError(f"Expected 2D embeddings, got shape {train_embeddings.shape}")
        n, d = train_embeddings.shape
        if n < 2:
            raise ValueError(f"Need at least 2 samples to fit, got {n}")
        self.mean = train_embeddings.mean(axis=0)
        cov = np.cov(train_embeddings.T)
        if cov.ndim == 0:
            cov = np.array([[float(cov)]])
        self.cov_inv = np.linalg.pinv(cov)

    def score(self, embedding: np.ndarray) -> float:
        """Mahalanobis distance — higher is more anomalous."""
        if self.mean is None or self.cov_inv is None:
            raise RuntimeError("Detector is not fitted")
        x = np.asarray(embedding, dtype=np.float64).reshape(-1)
        return float(mahalanobis(x, self.mean, self.cov_inv))

    def score_batch(self, embeddings: np.ndarray) -> np.ndarray:
        """Vectorized scores for (N, D) embeddings."""
        return np.array([self.score(e) for e in embeddings], dtype=np.float64)

    def set_threshold(
        self, val_embeddings: np.ndarray, percentile: float = 99.0
    ) -> float:
        """Set threshold from percentile of val genuine-cloud distances."""
        distances = self.score_batch(val_embeddings)
        self.threshold = float(np.percentile(distances, percentile))
        self.calibration_percentile = float(percentile)
        return self.threshold

    def is_anomaly(self, embedding: np.ndarray) -> bool:
        if self.threshold is None:
            raise RuntimeError("Threshold is not set")
        return self.score(embedding) > self.threshold

    def save_npz(self, path: str | Path) -> None:
        if self.mean is None or self.cov_inv is None or self.threshold is None:
            raise RuntimeError("Cannot save unfitted or uncalibrated detector")
        np.savez(
            path,
            mean=self.mean,
            cov_inv=self.cov_inv,
            threshold=np.array(self.threshold),
            calibration_percentile=np.array(
                self.calibration_percentile if self.calibration_percentile is not None else 99.0
            ),
        )

    @classmethod
    def load_npz(cls, path: str | Path) -> "MahalanobisAnomalyDetector":
        data = np.load(path)
        det = cls()
        det.mean = data["mean"]
        det.cov_inv = data["cov_inv"]
        det.threshold = float(data["threshold"])
        det.calibration_percentile = float(data["calibration_percentile"])
        return det
