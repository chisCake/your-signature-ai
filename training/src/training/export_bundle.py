"""Export trained run directory to model_bundle.zip for inference deployment."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from training.plots import compute_verification_threshold


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_metrics_summary(metrics_path: Path) -> Dict[str, Any]:
    import csv

    if not metrics_path.exists():
        return {}
    rows: List[Dict[str, str]] = []
    with open(metrics_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    def _f(key: str, row: Dict[str, str]) -> Optional[float]:
        v = row.get(key, "")
        if v in ("", None):
            return None
        try:
            return float(v)
        except ValueError:
            return None

    best_val_row = None
    best_val_eer = float("inf")
    for row in rows:
        if row.get("phase", "").lower() == "val":
            eer = _f("eer", row)
            if eer is not None and eer < best_val_eer:
                best_val_eer = eer
                best_val_row = row

    test_row = next((r for r in rows if r.get("phase", "").lower() == "test"), None)

    summary: Dict[str, Any] = {}
    if best_val_row:
        summary["best_epoch"] = int(float(best_val_row.get("epoch", 0)))
        summary["best_val_eer"] = _f("eer", best_val_row)
        summary["best_val_auc"] = _f("auc", best_val_row)
    if test_row:
        summary["final_test_eer"] = _f("eer", test_row)
        summary["final_test_auc"] = _f("auc", test_row)
    return summary


def build_manifest(
    *,
    bundle_name: str,
    run_name: str,
    configs: Dict[str, Any],
    thr_opt: float,
    val_eer: float,
    val_auc: float,
    training_summary: Dict[str, Any],
    bundle_sha256: str,
) -> Dict[str, Any]:
    dataset_cfg = configs.get("dataset_config", {})
    model_cfg = configs.get("model_config", {})
    pipeline: List[str] = list(dataset_cfg.get("feature_pipeline", []))
    in_features = len(pipeline)

    return {
        "schema_version": 1,
        "bundle_name": bundle_name,
        "run_name": run_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "feature_pipeline": pipeline,
        "in_features": in_features,
        "max_sequence_length": dataset_cfg.get("max_sequence_length", 1024),
        "verification": {
            "metric": "cosine_similarity",
            "threshold": thr_opt,
            "source": "val_eer_optimal",
            "val_eer": val_eer,
            "val_auc": val_auc,
        },
        "training_summary": {
            **training_summary,
            "verification_threshold": thr_opt,
        },
        "model": {
            "encoder_class": "SignatureEncoder",
            "conv_channels": list(model_cfg.get("cnn_channels", (64, 128, 256))),
            "gru_hidden": model_cfg.get("gru_hidden", 256),
            "gru_layers": model_cfg.get("gru_layers", 3),
            "embedding_dim": model_cfg.get("embedding_dim", 256),
            "dropout": model_cfg.get("dropout", 0.3),
        },
        "files": {
            "weights": "weights.pt",
            "encoder": "encoder.py",
            "features": "features.py",
            "configs": "configs.json",
        },
        "bundle_sha256": bundle_sha256,
    }


def is_exportable_run(run_dir: Path) -> bool:
    """Run directory has minimum artifacts for bundle export."""
    return (run_dir / "checkpoints" / "best_by_eer.pt").exists() and (
        run_dir / "model.py"
    ).exists()


def resolve_latest_run_dir(output_dir: str) -> Optional[Path]:
    """
    Pick the most recently modified run under *output_dir* that can be exported.
    """
    base = Path(output_dir)
    if not base.is_dir():
        return None

    candidates: List[Path] = []
    for child in base.iterdir():
        if child.is_dir() and is_exportable_run(child):
            candidates.append(child)

    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def export_bundle_from_run(
    run_dir: str,
    bundle_name: Optional[str] = None,
    *,
    checkpoint_path: str = "checkpoints/best_by_eer.pt",
    val_embeddings: Optional[np.ndarray] = None,
    val_labels: Optional[np.ndarray] = None,
    val_eer: Optional[float] = None,
    val_auc: Optional[float] = None,
) -> Path:
    """
    Export zip from an existing run folder (notebook / manual recovery).
    """
    run_path = Path(run_dir)
    if not is_exportable_run(run_path):
        raise FileNotFoundError(
            f"Run not exportable (need checkpoints/best_by_eer.pt and model.py): {run_path}"
        )
    name = bundle_name or run_path.name
    return export_model_bundle(
        str(run_path),
        name,
        checkpoint_path=checkpoint_path,
        val_embeddings=val_embeddings,
        val_labels=val_labels,
        val_eer=val_eer,
        val_auc=val_auc,
    )


def export_model_bundle(
    run_dir: str,
    bundle_name: str,
    *,
    checkpoint_path: str = "checkpoints/best_by_eer.pt",
    val_embeddings: Optional[np.ndarray] = None,
    val_labels: Optional[np.ndarray] = None,
    val_eer: Optional[float] = None,
    val_auc: Optional[float] = None,
) -> Path:
    """
    Pack run artifacts into {bundle_name}.zip under run_dir.
    """
    run_path = Path(run_dir)
    ckpt_path = run_path / checkpoint_path
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    configs_path = run_path / "configs.json"
    configs: Dict[str, Any] = {}
    if configs_path.exists():
        with open(configs_path, "r", encoding="utf-8") as f:
            configs = json.load(f)

    metrics_src = run_path / "logs" / "epoch_metrics.csv"
    if not metrics_src.exists():
        metrics_src = run_path / "logs" / "metrics.csv"
    training_summary = _read_metrics_summary(metrics_src)

    if val_embeddings is not None and val_labels is not None:
        thr_opt, val_auc_computed, val_eer_computed = compute_verification_threshold(
            val_embeddings, val_labels
        )
        val_auc = val_auc if val_auc is not None else val_auc_computed
        val_eer = val_eer if val_eer is not None else val_eer_computed
    else:
        thr_opt = float(training_summary.get("verification_threshold", 0.7))
        val_eer = float(training_summary.get("best_val_eer", 1.0) or 1.0)
        val_auc = float(training_summary.get("best_val_auc", 0.5) or 0.5)

    staging = run_path / "_bundle_staging"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    shutil.copy2(ckpt_path, staging / "weights.pt")
    model_py = run_path / "model.py"
    if model_py.exists():
        shutil.copy2(model_py, staging / "encoder.py")
    else:
        raise FileNotFoundError(f"encoder model.py missing in {run_dir}")

    features_src = Path(__file__).resolve().parents[1] / "data" / "features.py"
    shutil.copy2(features_src, staging / "features.py")
    if configs_path.exists():
        shutil.copy2(configs_path, staging / "configs.json")

    metrics_dst = staging / "metrics"
    metrics_dst.mkdir(exist_ok=True)
    if metrics_src.exists():
        shutil.copy2(metrics_src, metrics_dst / "epoch_metrics.csv")

    plots_src = run_path / "plots"
    if plots_src.exists():
        shutil.copytree(plots_src, staging / "plots")

    manifest = build_manifest(
        bundle_name=bundle_name,
        run_name=run_path.name,
        configs=configs,
        thr_opt=thr_opt,
        val_eer=val_eer,
        val_auc=val_auc,
        training_summary=training_summary,
        bundle_sha256="",
    )
    with open(staging / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    zip_path = run_path / f"{bundle_name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(staging):
            for name in files:
                full = Path(root) / name
                arc = full.relative_to(staging).as_posix()
                zf.write(full, arc)

    bundle_sha256 = _sha256_file(zip_path)
    manifest["bundle_sha256"] = bundle_sha256
    with zipfile.ZipFile(zip_path, "a", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))

    shutil.rmtree(staging)
    return zip_path
