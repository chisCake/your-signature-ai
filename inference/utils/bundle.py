"""Model bundle zip validation and unpack helpers."""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import torch

logger = logging.getLogger(__name__)

REQUIRED_FILES = ("manifest.json", "weights.pt", "encoder.py", "features.py")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def unpack_zip_bytes(zip_bytes: bytes, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp.write(zip_bytes)
        tmp_path = tmp.name
    try:
        with zipfile.ZipFile(tmp_path, "r") as zf:
            zf.extractall(dest_dir)
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    return dest_dir


def unpack_zip_file(zip_path: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)
    return dest_dir


def load_manifest(bundle_dir: Path) -> Dict[str, Any]:
    manifest_path = bundle_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest.json missing in {bundle_dir}")
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_manifest(manifest: Dict[str, Any]) -> None:
    if manifest.get("schema_version") != 1:
        raise ValueError("Unsupported manifest schema_version")
    pipeline = manifest.get("feature_pipeline")
    in_features = manifest.get("in_features")
    if not pipeline or not isinstance(pipeline, list):
        raise ValueError("manifest.feature_pipeline is required")
    if in_features != len(pipeline):
        raise ValueError(
            f"in_features ({in_features}) != len(feature_pipeline) ({len(pipeline)})"
        )
    if "verification" not in manifest or "threshold" not in manifest["verification"]:
        raise ValueError("manifest.verification.threshold is required")


def validate_bundle_dir(bundle_dir: Path) -> Dict[str, Any]:
    for name in REQUIRED_FILES:
        if not (bundle_dir / name).exists():
            raise FileNotFoundError(f"Missing required bundle file: {name}")
    manifest = load_manifest(bundle_dir)
    validate_manifest(manifest)
    return manifest


def pytorch_smoke_test(bundle_dir: Path, manifest: Dict[str, Any]) -> None:
    """Load encoder + weights without keeping model in memory."""
    import importlib.util
    import time

    encoder_path = bundle_dir / manifest["files"].get("encoder", "encoder.py")
    weights_path = bundle_dir / manifest["files"].get("weights", "weights.pt")

    module_name = f"bundle_encoder_{int(time.time() * 1_000_000)}"
    spec = importlib.util.spec_from_file_location(module_name, encoder_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load encoder from {encoder_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    model_class = getattr(module, "SignatureEncoder")

    model_cfg = manifest.get("model", {})
    conv_channels = tuple(model_cfg.get("conv_channels", (64, 128, 256)))
    model = model_class(
        in_features=manifest["in_features"],
        conv_channels=conv_channels,
        gru_hidden=model_cfg.get("gru_hidden", 256),
        gru_layers=model_cfg.get("gru_layers", 3),
        emb_dim=model_cfg.get("embedding_dim", 256),
        dropout=model_cfg.get("dropout", 0.3),
    )

    checkpoint = torch.load(weights_path, map_location="cpu", weights_only=False)
    state = (
        checkpoint.get("model")
        or checkpoint.get("model_state_dict")
        or checkpoint
    )
    if isinstance(state, dict) and "model" in state:
        state = state["model"]
    model.load_state_dict(state, strict=True)
    del model, checkpoint, module
