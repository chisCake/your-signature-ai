"""Fit and evaluate Mahalanobis anomaly detector for a training run."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
import torch
from torch.utils.data import DataLoader

from config import AugmentationConfig, DatasetConfig, ModelConfig, TrainingConfig
from data.anomaly_generator import ANOMALY_TYPES, AnomalyDataset
from data.augmentation import NoAugmentation
from data.lmdb_dataset import LmdbSignatureDataset
from models.hybrid import SignatureEncoder
from training.anomaly import MahalanobisAnomalyDetector
from training.embedding_collect import collect_embeddings

logger = logging.getLogger(__name__)


def _load_configs_from_json(
    configs: Dict[str, Any],
) -> Tuple[DatasetConfig, ModelConfig, TrainingConfig]:
    dc = dict(configs.get("dataset_config", {}))
    aug_raw = dc.pop("augmentation", None)
    if aug_raw and isinstance(aug_raw, dict):
        dc["augmentation"] = AugmentationConfig(**aug_raw)
    mc = dict(configs.get("model_config", {}))
    if "cnn_channels" in mc and isinstance(mc["cnn_channels"], list):
        mc["cnn_channels"] = tuple(mc["cnn_channels"])
    tc = dict(configs.get("training_config", {}))
    return (
        DatasetConfig(**{k: v for k, v in dc.items() if k in DatasetConfig.__dataclass_fields__}),
        ModelConfig(**{k: v for k, v in mc.items() if k in ModelConfig.__dataclass_fields__}),
        TrainingConfig(**{k: v for k, v in tc.items() if k in TrainingConfig.__dataclass_fields__}),
    )


def load_data_splits(path: str | Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_data_splits_json(
    run_dir: str | Path,
    *,
    seed: int,
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
    train_user_codes: list,
    val_user_codes: list,
    test_user_codes: list,
) -> Path:
    """Persist user split lists for standalone anomaly calibration."""
    payload = {
        "seed": seed,
        "train_ratio": train_ratio,
        "val_ratio": val_ratio,
        "test_ratio": test_ratio,
        "train_user_codes": list(train_user_codes),
        "val_user_codes": list(val_user_codes),
        "test_user_codes": list(test_user_codes),
    }
    out = Path(run_dir) / "data_splits.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return out


def _subset_for_users(
    full_dataset: LmdbSignatureDataset,
    user_codes: set,
    user_index: Dict[str, list],
):
    """Subset via pre-built user index (no augmentation)."""
    indices = [idx for uc in user_codes for idx in user_index.get(uc, [])]

    class _Subset:
        def __init__(self, dataset, indices, transform=None):
            self.dataset = dataset
            self.indices = indices
            self.transform = transform

        def __len__(self):
            return len(self.indices)

        def __getitem__(self, idx):
            original_idx = self.indices[idx]
            tensor, mask, user_id, user_code = self.dataset[original_idx]
            if self.transform is not None:
                tensor = self.transform(tensor)
            return tensor, mask, user_id

        def collate_fn(self, batch):
            return self.dataset.collate_fn(batch)

    wrapper = _Subset(full_dataset, indices, transform=NoAugmentation())
    wrapper.collate_fn = wrapper.collate_fn
    return wrapper  # type: ignore[return-value]


def _build_user_index(dataset: LmdbSignatureDataset) -> Dict[str, list]:
    from collections import defaultdict

    index: Dict[str, list] = defaultdict(list)
    for idx in range(len(dataset)):
        uc = dataset.get_user_code(idx)
        if uc:
            index[uc].append(idx)
    return dict(index)


def _load_encoder(
    checkpoint_path: Path,
    dataset_cfg: DatasetConfig,
    model_cfg: ModelConfig,
    device: torch.device,
) -> SignatureEncoder:
    in_features = len(dataset_cfg.feature_pipeline)
    model = SignatureEncoder(
        in_features=in_features,
        conv_channels=model_cfg.cnn_channels,
        gru_hidden=model_cfg.gru_hidden,
        gru_layers=model_cfg.gru_layers,
        emb_dim=model_cfg.embedding_dim,
        dropout=model_cfg.dropout,
    )
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    state = ckpt.get("model") or ckpt.get("model_state_dict") or ckpt
    model.load_state_dict(state)
    model.to(device)
    model.eval()
    return model


@torch.no_grad()
def _collect_synthetic_embeddings(
    model: SignatureEncoder,
    dataset_cfg: DatasetConfig,
    device: torch.device,
    n_samples: int,
    seed: int,
    batch_size: int = 64,
) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
    """Encode synthetic anomalies; return (N,D) and per-type distance arrays after scoring."""
    syn_ds = AnomalyDataset(
        n_samples=n_samples,
        max_sequence_length=dataset_cfg.max_sequence_length,
        feature_pipeline=dataset_cfg.feature_pipeline,
        seed=seed,
    )
    loader = DataLoader(
        syn_ds,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=LmdbSignatureDataset.collate_fn,
    )
    types_list = [t for _, t in syn_ds._samples]
    all_emb: list[torch.Tensor] = []
    for batch in loader:
        x, _labels, mask = batch
        x = x.to(device)
        if mask is not None:
            mask = mask.to(device)
        emb = model(x, mask)
        all_emb.append(emb.cpu())

    emb_np = torch.cat(all_emb, dim=0).numpy()
    return emb_np, {"types": np.array(types_list)}


def _plot_distance_histograms(
    plot_dir: Path,
    train_dist: np.ndarray,
    val_dist: np.ndarray,
    syn_dist: np.ndarray,
    threshold: float,
) -> None:
    plot_dir.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 3, figsize=(14, 4))
    for ax, dist, title in zip(
        axes,
        [train_dist, val_dist, syn_dist],
        ["train (fit)", "val (threshold)", "synthetic"],
    ):
        ax.hist(dist, bins=50, alpha=0.75, edgecolor="black")
        ax.axvline(threshold, color="red", linestyle="--", label=f"thr={threshold:.3f}")
        ax.set_title(title)
        ax.legend()
    fig.tight_layout()
    fig.savefig(plot_dir / "anomaly_dist_histograms.png", dpi=120)
    plt.close(fig)


def calibrate_anomaly_detector(
    run_dir: str | Path,
    *,
    checkpoint_path: str = "checkpoints/best_by_eer.pt",
    data_splits_path: Optional[str | Path] = None,
    dataset_cfg: Optional[DatasetConfig] = None,
    model_cfg: Optional[ModelConfig] = None,
    train_cfg: Optional[TrainingConfig] = None,
    device: Optional[torch.device] = None,
    percentile: Optional[float] = None,
    synthetic_n: Optional[int] = None,
    full_dataset: Optional[LmdbSignatureDataset] = None,
    user_index: Optional[Mapping[str, list]] = None,
    log_fn=None,
) -> Tuple[MahalanobisAnomalyDetector, Dict[str, Any]]:
    """
    Fit Mahalanobis detector, calibrate threshold on val, evaluate on synthetics.
    Writes anomaly_params.npz, logs/anomaly_eval.json, plots.
    """
    run_path = Path(run_dir)
    log = log_fn or logger.info

    configs_path = run_path / "configs.json"
    if configs_path.exists():
        with open(configs_path, "r", encoding="utf-8") as f:
            configs = json.load(f)
    else:
        configs = {}

    if dataset_cfg is None or model_cfg is None or train_cfg is None:
        dataset_cfg, model_cfg, train_cfg = _load_configs_from_json(configs)

    percentile = float(percentile if percentile is not None else train_cfg.anomaly_percentile)
    synthetic_n = int(synthetic_n if synthetic_n is not None else train_cfg.anomaly_synthetic_n)

    splits_path = Path(data_splits_path) if data_splits_path else run_path / "data_splits.json"
    if not splits_path.exists():
        raise FileNotFoundError(f"data_splits.json not found: {splits_path}")

    splits = load_data_splits(splits_path)
    train_users = set(splits["train_user_codes"])
    val_users = set(splits["val_user_codes"])

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    ckpt = run_path / checkpoint_path
    if not ckpt.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt}")

    log(f"Anomaly calibration: loading model from {ckpt}")
    model = _load_encoder(ckpt, dataset_cfg, model_cfg, device)

    if full_dataset is not None and user_index is not None:
        log("Reusing open LMDB dataset from training run (split subsets)...")
        idx_map = user_index
        ds = full_dataset
    else:
        log("Loading LMDB and building split subsets...")
        ds = LmdbSignatureDataset(
            lmdb_path=dataset_cfg.lmdb_path,
            max_sequence_length=dataset_cfg.max_sequence_length,
            feature_pipeline=dataset_cfg.feature_pipeline,
            return_user_code=True,
        )
        idx_map = _build_user_index(ds)

    train_ds = _subset_for_users(ds, train_users, idx_map)
    val_ds = _subset_for_users(ds, val_users, idx_map)

    log(f"Collecting train embeddings ({len(train_ds)} samples)...")
    train_emb = collect_embeddings(
        model, train_ds, device, batch_size=dataset_cfg.batch_size, desc="anomaly_train"
    )
    if train_emb.shape[0] < train_cfg.anomaly_min_samples:
        raise RuntimeError(
            f"Too few train samples for anomaly fit: {train_emb.shape[0]} "
            f"< {train_cfg.anomaly_min_samples}"
        )

    log(f"Collecting val embeddings ({len(val_ds)} samples)...")
    val_emb = collect_embeddings(
        model, val_ds, device, batch_size=dataset_cfg.batch_size, desc="anomaly_val"
    )

    detector = MahalanobisAnomalyDetector()
    detector.fit(train_emb)
    threshold = detector.set_threshold(val_emb, percentile=percentile)
    log(f"Anomaly threshold (p{percentile} on val): {threshold:.6f}")

    train_dist = detector.score_batch(train_emb)
    val_dist = detector.score_batch(val_emb)
    val_pass_rate = float(np.mean(val_dist <= threshold))

    log(f"Encoding {synthetic_n} synthetic anomalies...")
    syn_emb, syn_meta = _collect_synthetic_embeddings(
        model,
        dataset_cfg,
        device,
        n_samples=synthetic_n,
        seed=train_cfg.seed + 1,
        batch_size=dataset_cfg.batch_size,
    )
    syn_dist = detector.score_batch(syn_emb)
    syn_rejected = syn_dist > threshold
    synthetic_reject_rate = float(np.mean(syn_rejected))

    types = syn_meta["types"]
    per_type: Dict[str, float] = {}
    for atype in ANOMALY_TYPES:
        mask = types == atype
        if mask.any():
            per_type[atype] = float(np.mean(syn_rejected[mask]))

    stats: Dict[str, Any] = {
        "enabled": True,
        "metric": "mahalanobis",
        "threshold": float(threshold),
        "calibration_percentile": percentile,
        "fit_split": "train",
        "threshold_split": "val",
        "n_fit_samples": int(train_emb.shape[0]),
        "n_val_samples": int(val_emb.shape[0]),
        "embedding_dim": int(train_emb.shape[1]),
        "val_pass_rate": val_pass_rate,
        "synthetic_reject_rate": synthetic_reject_rate,
        "synthetic_n": synthetic_n,
        "per_type_reject_rate": per_type,
        "files": {"params": "anomaly_params.npz"},
    }

    npz_path = run_path / "anomaly_params.npz"
    detector.save_npz(npz_path)
    log(f"Saved {npz_path}")

    logs_dir = run_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    eval_path = logs_dir / "anomaly_eval.json"
    with open(eval_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    log(f"Saved {eval_path}")

    plot_dir = run_path / "plots"
    _plot_distance_histograms(plot_dir, train_dist, val_dist, syn_dist, threshold)

    return detector, stats
