from typing import List, Dict, Optional
import os
import csv
import matplotlib.pyplot as plt  # pyright: ignore[reportMissingImports]
import seaborn as sns  # pyright: ignore[reportMissingModuleSource]
import numpy as np
from sklearn.metrics import (  # pyright: ignore[reportMissingImports]
    roc_curve,
    confusion_matrix,
    roc_auc_score,
)
from matplotlib import ticker  # pyright: ignore[reportMissingImports]


sns.set(style="whitegrid")


def _load_metrics(csv_path: str) -> Dict[str, List[float]]:
    """Load metrics CSV file produced by TrainingRunner.

    Returns a dict where keys are column names and values are list of floats/str.
    """
    metrics: Dict[str, List] = {}
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Metrics CSV not found: {csv_path}")

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            for k, v in row.items():
                metrics.setdefault(k, []).append(v)
    # Convert numeric columns to float where possible
    for k, values in metrics.items():
        try:
            metrics[k] = [
                float(x) if x not in ("", None) else float("nan") for x in values
            ]
        except ValueError:
            # keep as string
            pass
    return metrics


def _optimal_threshold(
    fpr: np.ndarray, tpr: np.ndarray, thresholds: np.ndarray
) -> float:
    # pick threshold closest to EER (where FPR ~= 1-TPR)
    fnr = 1 - tpr
    idx = np.nanargmin(np.abs(fnr - fpr))
    return thresholds[idx]


def generate_eval_plots(
    emb: np.ndarray, labels: np.ndarray, output_dir: str, tag: str = "val"
) -> None:
    """Given embeddings and labels, compute pairwise scores and save DET, CM, ROC images."""
    os.makedirs(output_dir, exist_ok=True)
    # cosine similarity matrix
    sim = emb @ emb.T
    n = labels.shape[0]
    iu = np.triu_indices(n, k=1)
    scores = sim[iu]
    same = (labels[:, None] == labels[None, :])[iu].astype(int)

    fpr, tpr, thr = roc_curve(same, scores)
    auc = roc_auc_score(same, scores)
    thr_opt = _optimal_threshold(fpr, tpr, thr)

    # DET
    fnr = 1 - tpr
    plt.figure(figsize=(5, 5))
    plt.plot(fpr, fnr, label="DET")
    plt.plot([0, 1], [0, 1], "--", color="gray", lw=0.8)
    plt.xscale("log")
    plt.yscale("log")
    plt.xlabel("FPR")
    plt.ylabel("FNR")
    plt.title("DET curve")
    plt.grid(True, which="both", ls="--", lw=0.5)
    plt.savefig(os.path.join(output_dir, f"det_{tag}.png"))
    plt.close()

    # Confusion matrix at optimal threshold
    y_pred = (scores >= thr_opt).astype(int)
    cm = confusion_matrix(same, y_pred)
    plt.figure(figsize=(4, 4))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False)
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.title(f"Confusion Matrix @thr={thr_opt:.3f}")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"cm_{tag}.png"))
    plt.close()

    # ROC
    plt.figure(figsize=(5, 5))
    plt.plot(fpr, tpr, label=f"ROC (AUC={auc:.3f})")
    plt.scatter(
        [fpr[np.argmin(np.abs(thr - thr_opt))]],
        [tpr[np.argmin(np.abs(thr - thr_opt))]],
        color="red",
        label=f"OptThr={thr_opt:.3f}",
    )
    plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.xlabel("FPR")
    plt.ylabel("TPR")
    plt.title("ROC curve")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"roc_{tag}.png"))
    plt.close()


def generate_quality_plots(
    metrics_csv: str, output_dir: str, stage: str, epoch: Optional[int] = None
) -> None:
    """Generate and save quality plots.

    Args:
        metrics_csv: Path to epoch_metrics.csv.
        output_dir: Directory where images will be saved (usually log_dir).
        stage: Either "val" or "test".
        epoch: Current epoch number when stage == "val".
    """
    os.makedirs(output_dir, exist_ok=True)
    data = _load_metrics(metrics_csv)

    # Plot EER over epochs (skip FINAL_TEST rows which have non-numeric epoch)
    try:
        epochs = [int(e) for e in data["epoch"] if str(e).isdigit()]
    except KeyError:
        print("Epoch column not found in metrics CSV, skipping plot generation.")
        return

    val_eer = data.get("val_eer", [])[: len(epochs)]
    best_eer = data.get("best_eer", [])[: len(epochs)]

    plt.figure(figsize=(8, 5))
    plt.plot(epochs, val_eer, label="Validation EER", marker="o")
    plt.plot(epochs, best_eer, label="Best EER", linestyle="--")
    plt.xlabel("Epoch")
    plt.ylabel("EER")
    plt.title("EER over Epochs")
    plt.legend()
    plt.tight_layout()

    if stage == "val" and epoch is not None:
        fname = f"eer_curve_epoch_{epoch + 1}.png"
    else:
        fname = "eer_curve_final.png"
    plt.savefig(os.path.join(output_dir, fname))
    plt.close()

    # Scatter EER vs AUC
    aucs = data.get("val_auc", [])[: len(epochs)]
    if aucs:
        plt.figure(figsize=(6, 6))
        sc = plt.scatter(aucs, val_eer, c=epochs, cmap="viridis", s=40)
        plt.colorbar(sc, label="Epoch")
        plt.xlabel("AUC")
        plt.ylabel("EER")
        plt.title("EER vs AUC")
        plt.tight_layout()
        if stage == "val" and epoch is not None:
            fname = f"eer_auc_epoch_{epoch + 1}.png"
        else:
            fname = "eer_auc_final.png"
        plt.savefig(os.path.join(output_dir, fname))
        plt.close()

    # Additional plots can be added as needed.
