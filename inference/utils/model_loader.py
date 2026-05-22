"""
ModelLoader — loads SignatureEncoder from unpacked bundle directory (models/current/).
"""

import gc
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import psutil
import torch

from memory_config import MemoryConfig
from utils.bundle import load_manifest, validate_bundle_dir

logger = logging.getLogger(__name__)

if "config" not in sys.modules:
    from dataclasses import dataclass, field
    from typing import List

    @dataclass
    class AugmentationConfig:
        time_warp_prob: float = 0.5

    config_module = type(sys)("config")
    config_module.AugmentationConfig = AugmentationConfig
    sys.modules["config"] = config_module


def _import_encoder_class(encoder_path: Path):
    import importlib.util

    module_name = f"bundle_encoder_{int(time.time() * 1_000_000)}"
    spec = importlib.util.spec_from_file_location(module_name, encoder_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load encoder from {encoder_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return getattr(module, "SignatureEncoder")


class ModelLoader:
    """Loads active bundle from a directory (weights.pt + encoder.py + manifest)."""

    def __init__(self, bundle_dir: str | Path):
        MemoryConfig.apply_torch_settings()
        self.bundle_dir = Path(bundle_dir)
        self.manifest = validate_bundle_dir(self.bundle_dir)
        self.feature_pipeline = list(self.manifest["feature_pipeline"])
        self.verification_threshold = float(
            self.manifest["verification"]["threshold"]
        )
        self.bundle_name = self.manifest.get("bundle_name", self.bundle_dir.name)

        files = self.manifest.get("files", {})
        self.weights_path = self.bundle_dir / files.get("weights", "weights.pt")
        self.encoder_path = self.bundle_dir / files.get("encoder", "encoder.py")

        self.device = self._get_device()
        self.model: Optional[Any] = None
        self.is_model_loaded = False
        self.model_config: Dict[str, Any] = {}

        self.load_model()

    def _get_device(self) -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")
        if torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    def load_model(self) -> None:
        if not self.weights_path.exists():
            raise FileNotFoundError(f"Weights not found: {self.weights_path}")

        model_class = _import_encoder_class(self.encoder_path)
        model_cfg = self.manifest.get("model", {})
        conv_channels = tuple(model_cfg.get("conv_channels", (64, 128, 256)))

        self.model_config = {
            "in_features": self.manifest["in_features"],
            "conv_channels": conv_channels,
            "gru_hidden": model_cfg.get("gru_hidden", 256),
            "gru_layers": model_cfg.get("gru_layers", 3),
            "embedding_dim": model_cfg.get("embedding_dim", 256),
            "dropout": model_cfg.get("dropout", 0.3),
        }

        self.model = model_class(
            in_features=self.model_config["in_features"],
            conv_channels=conv_channels,
            gru_hidden=self.model_config["gru_hidden"],
            gru_layers=self.model_config["gru_layers"],
            emb_dim=self.model_config["embedding_dim"],
            dropout=self.model_config["dropout"],
        )

        loading_kwargs = MemoryConfig.get_model_loading_kwargs()
        loading_kwargs["map_location"] = self.device
        safe_kwargs = {
            k: loading_kwargs[k]
            for k in ("map_location", "weights_only")
            if k in loading_kwargs
        }
        checkpoint = torch.load(self.weights_path, **safe_kwargs)

        if isinstance(checkpoint, dict) and "model" in checkpoint:
            self.model.load_state_dict(checkpoint["model"])
        elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            self.model.load_state_dict(checkpoint["model_state_dict"])
        else:
            raise ValueError("Could not find model weights in checkpoint")

        self.model = self.model.to(self.device)
        self.model.eval()
        del checkpoint
        gc.collect()
        self.is_model_loaded = True
        logger.info(
            "Loaded bundle %s from %s (threshold=%.4f)",
            self.bundle_name,
            self.bundle_dir,
            self.verification_threshold,
        )

    def is_loaded(self) -> bool:
        return self.is_model_loaded and self.model is not None

    def get_model(self) -> Optional[Any]:
        return self.model if self.is_loaded() else None

    def encode_signature(
        self, signature_data: torch.Tensor, mask: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        if not self.is_loaded():
            raise RuntimeError("Model is not loaded")
        with torch.no_grad():
            signature_data = signature_data.to(self.device)
            if mask is not None:
                mask = mask.to(self.device)
            embeddings = self.model(signature_data, mask)
            if torch.isnan(embeddings).any() or torch.isinf(embeddings).any():
                raise RuntimeError("Invalid embeddings (NaN/Inf)")
            return embeddings

    def get_model_info(self) -> dict:
        if not self.is_loaded():
            return {"status": "not_loaded"}

        info: Dict[str, Any] = {
            "status": "loaded",
            "bundle_name": self.bundle_name,
            "bundle_dir": str(self.bundle_dir),
            "device": str(self.device),
            "loaded": True,
            "model_type": "SignatureEncoder",
            "feature_pipeline": self.feature_pipeline,
            "verification_threshold": self.verification_threshold,
            "manifest": {
                "training_summary": self.manifest.get("training_summary"),
                "verification": self.manifest.get("verification"),
                "run_name": self.manifest.get("run_name"),
                "created_at": self.manifest.get("created_at"),
            },
            "architecture": "CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding",
        }
        if self.model_config:
            info["model_config"] = self.model_config
        if self.model is not None:
            total_params = sum(p.numel() for p in self.model.parameters())
            info["total_parameters"] = total_params
            info["trainable_parameters"] = sum(
                p.numel() for p in self.model.parameters() if p.requires_grad
            )
        return info

    def unload_model(self) -> None:
        if self.model is not None:
            del self.model
            self.model = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_model_loaded = False

    def get_memory_info(self) -> dict:
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            return {
                "rss_mb": memory_info.rss / 1024 / 1024,
                "model_loaded": self.is_model_loaded,
            }
        except Exception as e:
            return {"error": str(e)}
