from __future__ import annotations

from typing import Dict, List, Tuple, Optional, Any
import os
import io
import csv
import json
import lmdb
import numpy as np
import pandas as pd
from collections import defaultdict, Counter


def _percentile_coverage(lengths: np.ndarray, thresholds: List[int]) -> Dict[int, float]:
    coverage: Dict[int, float] = {}
    if lengths.size == 0:
        return {t: 0.0 for t in thresholds}
    sorted_lengths = np.sort(lengths)
    n = float(len(sorted_lengths))
    for t in thresholds:
        covered = np.searchsorted(sorted_lengths, t, side="right")
        coverage[t] = covered / n
    return coverage


def _detect_environment_num_workers(default: int = 2) -> int:
    # Prefer stability for LMDB: 0 on Colab and Windows
    try:
        import google.colab  # type: ignore
        return 0
    except Exception:
        pass
    if os.name == "nt":
        return 0
    return default


def analyze_lmdb_dataset(lmdb_path: str) -> Dict[str, Any]:
    env = lmdb.open(lmdb_path, readonly=True, lock=False, readahead=True, max_readers=2048)
    rows: List[Dict[str, Any]] = []

    with env.begin() as txn:
        index_bytes = txn.get(b"__index__")
        if index_bytes is None:
            raise RuntimeError(f"LMDB index not found at {lmdb_path}")
        keys = [k for k in index_bytes.decode("utf-8").splitlines() if k]

        for key in keys:
            csv_b = txn.get(key.encode("utf-8"))
            if csv_b is None:
                continue
            label_b = txn.get(f"{key}:label".encode("utf-8"))
            input_type_b = txn.get(f"{key}:input_type".encode("utf-8"))
            user_code_b = txn.get(f"{key}:user_code".encode("utf-8"))
            rows.append(
                {
                    "key": key,
                    "label": (label_b.decode("utf-8") if label_b else ""),
                    "input_type": (input_type_b.decode("utf-8") if input_type_b else ""),
                    "user_code": (user_code_b.decode("utf-8") if user_code_b else ""),
                    "csv": csv_b.decode("utf-8"),
                }
            )

    env.close()

    if not rows:
        raise RuntimeError("LMDB appears empty")

    # Sequence lengths (by counting data rows) and t_max per sample
    seq_lengths: List[int] = []
    t_max_values: List[float] = []
    by_label_it: Dict[Tuple[str, str], List[int]] = defaultdict(list)
    per_user_counts: Dict[str, int] = defaultdict(int)
    per_user_label_counts: Dict[Tuple[str, str], int] = defaultdict(int)  # (user,label) -> count

    feature_mins = {c: np.inf for c in ["x", "y", "t", "p"]}
    feature_maxs = {c: -np.inf for c in ["x", "y", "t", "p"]}

    for r in rows:
        csv_text = r["csv"]
        try:
            table = list(csv.reader(csv_text.strip().split("\n")))
        except Exception:
            continue
        if len(table) <= 1:
            continue
        data_rows = table[1:]
        seq_lengths.append(len(data_rows))
        # t_max
        try:
            t_max_values.append(float(data_rows[-1][0]))
        except Exception:
            pass

        # Feature ranges
        try:
            import pandas as _pd

            df = _pd.read_csv(io.StringIO(csv_text))
            for col in feature_mins.keys():
                if col in df.columns and len(df[col]) > 0:
                    v = df[col].values
                    feature_mins[col] = min(feature_mins[col], float(np.nanmin(v)))
                    feature_maxs[col] = max(feature_maxs[col], float(np.nanmax(v)))
        except Exception:
            pass

        by_label_it[(r["label"], r["input_type"])].append(len(data_rows))
        uc = r.get("user_code", "")
        if uc:
            per_user_counts[uc] += 1
            per_user_label_counts[(uc, r["label"])] += 1

    lengths_arr = np.array(seq_lengths, dtype=np.int32)
    tmax_arr = np.array(t_max_values, dtype=np.float32) if t_max_values else np.array([])

    # Basic stats
    stats = {
        "total_samples": int(len(lengths_arr)),
        "seq_len": {
            "mean": float(lengths_arr.mean()),
            "median": float(np.median(lengths_arr)),
            "std": float(lengths_arr.std()),
            "min": int(lengths_arr.min()),
            "max": int(lengths_arr.max()),
        },
        "t_max": (
            {
                "mean": float(tmax_arr.mean()),
                "median": float(np.median(tmax_arr)),
                "std": float(tmax_arr.std()),
                "min": float(tmax_arr.min()),
                "max": float(tmax_arr.max()),
            }
            if tmax_arr.size > 0
            else None
        ),
    }

    # Coverage recommendations for max_sequence_length
    thresholds = [800, 1000, 1200, 1500, 2000, 2500]
    coverage = _percentile_coverage(lengths_arr, thresholds)

    # Per-user distribution and recommended K
    user_counts = np.array(list(per_user_counts.values()), dtype=np.int32) if per_user_counts else np.array([])
    rec_k = None
    rec_k_per_label = {}
    if user_counts.size > 0:
        per_label_map: Dict[str, List[int]] = defaultdict(list)
        for (uc, lbl), cnt in per_user_label_counts.items():
            per_label_map[lbl].append(cnt)
        # For triplet mining, K>=2. Pick K as min(4, p10 of per-user counts per label)
        for lbl, counts in per_label_map.items():
            arr = np.array(counts, dtype=np.int32)
            if arr.size > 0:
                p10 = max(2, int(np.percentile(arr, 10)))
                rec_k_per_label[lbl] = int(min(4, p10))
        # Fallback overall
        p10_all = max(2, int(np.percentile(user_counts, 10)))
        rec_k = int(min(4, p10_all))

    label_counts = Counter([r["label"] for r in rows])
    input_type_counts = Counter([r["input_type"] for r in rows])

    return {
        "counts": {
            "by_label": dict(label_counts),
            "by_input_type": dict(input_type_counts),
        },
        "stats": stats,
        "coverage": coverage,
        "per_user": {
            "num_users": int(len(per_user_counts)),
            "min_per_user": int(user_counts.min()) if user_counts.size > 0 else 0,
            "median_per_user": float(np.median(user_counts)) if user_counts.size > 0 else 0.0,
            "p10_per_user": float(np.percentile(user_counts, 10)) if user_counts.size > 0 else 0.0,
        },
        "recommended": {
            "max_sequence_length_options": coverage,  # length->coverage fraction
            "recommended_K_overall": rec_k,
            "recommended_K_per_label": rec_k_per_label,
            "recommended_num_workers": _detect_environment_num_workers(),
        },
        "feature_ranges": feature_mins | feature_maxs,
    }


def suggest_training_config(
    analysis: Dict[str, Any], *, batch_size: int = 128
) -> Dict[str, Any]:
    # Choose max_sequence_length to cover ~95%-98%
    cov = analysis.get("coverage", {})
    candidate_lengths = sorted(cov.keys())
    chosen_len = None
    for L in candidate_lengths:
        if cov[L] >= 0.96:  # target coverage
            chosen_len = L
            break
    if chosen_len is None and candidate_lengths:
        chosen_len = candidate_lengths[-1]

    # PK sampler suggestion
    K = analysis.get("recommended", {}).get("recommended_K_overall", 4) or 4
    # Keep P such that P*K <= batch_size and P is a power-of-two-ish value
    possible_P = [64, 48, 32, 24, 16, 8, 4]
    P = next((p for p in possible_P if p * K <= batch_size), 16)
    if P * K > batch_size:
        # Fallback to ensure constraint
        P = max(1, batch_size // K)

    return {
        "batch_size": batch_size,
        "max_sequence_length": chosen_len,
        "PKSampler": {"P": P, "K": K},
        "num_workers": analysis.get("recommended", {}).get("recommended_num_workers", 0),
        "notes": [
            "Consider lowering learning_rate to 1e-4 and weight_decay to 1e-5 if NaNs persist.",
            "Enable gradient clipping (already implemented) and optionally disable AMP for debugging.",
        ],
    }


def run_diagnostics(lmdb_path: str, *, batch_size: int = 128, save_json: bool = True) -> Dict[str, Any]:
    analysis = analyze_lmdb_dataset(lmdb_path)
    rec = suggest_training_config(analysis, batch_size=batch_size)
    report = {"analysis": analysis, "recommendations": rec}

    if save_json:
        out_dir = os.path.dirname(lmdb_path)
        out_path = os.path.join(out_dir, "lmdb_diagnostics.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    return report


__all__ = ["analyze_lmdb_dataset", "suggest_training_config", "run_diagnostics"]


