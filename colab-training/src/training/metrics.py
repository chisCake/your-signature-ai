# src/training/metrics.py
import numpy as np
from sklearn.metrics import roc_curve, roc_auc_score

def compute_eer_auc(embeddings: np.ndarray, labels: np.ndarray):
    """
    embeddings: (N, D) numpy
    labels: (N,) numpy ints
    returns: eer (float in [0,1]), auc (float)
    """
    # pairwise cosine similarity via dot (embeds assumed L2-normalized)
    sim = embeddings @ embeddings.T
    n = len(labels)
    iu = np.triu_indices(n, k=1)
    scores = sim[iu]
    same = (labels[:, None] == labels[None, :])[iu].astype(int)

    if len(np.unique(same)) == 1:
        # degenerate case
        return 1.0, 0.5

    fpr, tpr, thr = roc_curve(same, scores)
    auc = float(roc_auc_score(same, scores))

    fnr = 1 - tpr
    # find threshold where |FNR - FPR| minimal
    idx = np.nanargmin(np.abs(fnr - fpr))
    eer = float((fpr[idx] + fnr[idx]) / 2.0)
    return eer, auc