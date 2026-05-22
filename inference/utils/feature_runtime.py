"""Dynamic import of features.py from active model bundle."""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from pathlib import Path
from typing import Any, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_cached_module_path: Optional[str] = None
_cached_module: Any = None


def _load_features_module(features_path: Path) -> Any:
    global _cached_module_path, _cached_module
    path_str = str(features_path.resolve())
    if _cached_module_path == path_str and _cached_module is not None:
        return _cached_module

    module_name = f"bundle_features_{int(time.time() * 1_000_000)}"
    spec = importlib.util.spec_from_file_location(module_name, features_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load features from {features_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    _cached_module_path = path_str
    _cached_module = module
    logger.info("Loaded features module from %s", features_path)
    return module


def clear_features_cache() -> None:
    global _cached_module_path, _cached_module
    _cached_module_path = None
    _cached_module = None


def build_model_features(
    raw_points: np.ndarray,
    pipeline: List[str],
    bundle_dir: Path,
) -> np.ndarray:
    features_path = bundle_dir / "features.py"
    if not features_path.exists():
        raise FileNotFoundError(f"features.py not found in {bundle_dir}")
    module = _load_features_module(features_path)
    if hasattr(module, "build_model_features"):
        return module.build_model_features(raw_points, pipeline)
    if hasattr(module, "normalize_raw_sequence") and hasattr(
        module, "apply_feature_pipeline"
    ):
        import torch

        norm = module.normalize_raw_sequence(raw_points)
        tensor = torch.from_numpy(norm)
        out = module.apply_feature_pipeline(tensor, pipeline)
        return out.detach().cpu().numpy().astype(np.float32)
    raise AttributeError("Bundle features.py missing build_model_features")
