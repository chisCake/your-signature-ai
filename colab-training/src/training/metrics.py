from __future__ import annotations

from typing import Tuple, Dict
import numpy as np
import torch
from sklearn.metrics import roc_curve, auc, roc_auc_score


def compute_eer(y_true: np.ndarray, y_score: np.ndarray) -> Tuple[float, float]:
    fpr, tpr, thresholds = roc_curve(y_true, y_score)
    fnr = 1 - tpr
    # EER where FPR ~= FNR
    idx = np.nanargmin(np.abs(fnr - fpr))
    eer = float((fnr[idx] + fpr[idx]) / 2.0)
    thr = float(thresholds[idx])
    return eer, thr


def compute_metrics(y_true: np.ndarray, y_score: np.ndarray) -> Dict[str, float]:
    eer, thr = compute_eer(y_true, y_score)
    try:
        roc_auc = float(roc_auc_score(y_true, y_score))
    except Exception:
        roc_auc = float('nan')
    fpr, tpr, _ = roc_curve(y_true, y_score)
    roc_auc_curve = float(auc(fpr, tpr))
    # naive accuracy at threshold
    y_pred = (y_score >= thr).astype(np.int32)
    acc = float((y_pred == y_true).mean())
    return {
        "eer": eer,
        "eer_thr": thr,
        "roc_auc": roc_auc,
        "roc_auc_curve": roc_auc_curve,
        "acc": acc,
    }


def compute_verification_metrics(embeddings: torch.Tensor, labels: torch.Tensor) -> Dict[str, float]:
    """
    Compute verification metrics (EER, ROC AUC, Accuracy) from embeddings and labels.
    
    Args:
        embeddings: Tensor of shape [N, D] containing L2-normalized embeddings
        labels: Tensor of shape [N] containing binary labels (0=forgery, 1=genuine)
    
    Returns:
        Dictionary with keys: eer, eer_thr, roc_auc, roc_auc_curve, acc
    """
    # Compute pairwise cosine similarity (since embeddings are L2-normalized)
    emb_np = embeddings.cpu().numpy()
    labels_np = labels.cpu().numpy()
    
    # Create pairwise similarity scores and labels
    # For each pair (i, j) where i < j:
    #   - If labels[i] == labels[j] == 1 (both genuine): positive pair (y=1)
    #   - Otherwise: negative pair (y=0)
    scores = []
    pair_labels = []
    
    N = len(emb_np)
    for i in range(N):
        for j in range(i + 1, N):
            sim = np.dot(emb_np[i], emb_np[j])  # cosine similarity
            scores.append(sim)
            # Positive pair: both are genuine (label=1)
            pair_labels.append(int(labels_np[i] == 1 and labels_np[j] == 1))
    
    scores_arr = np.array(scores)
    labels_arr = np.array(pair_labels)
    
    return compute_metrics(labels_arr, scores_arr)
