"""Collect encoder embeddings over a dataset split (no augmentation)."""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

logger = logging.getLogger(__name__)


@torch.no_grad()
def collect_embeddings(
    model: torch.nn.Module,
    dataset,
    device: torch.device,
    *,
    batch_size: int = 64,
    num_workers: int = 0,
    desc: str = "collect_embeddings",
) -> np.ndarray:
    """
    Run encoder over *dataset* and return (N, D) numpy embeddings.
    Expects collate_fn on dataset returning (x, labels, mask).
    """
    model.eval()
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        collate_fn=getattr(dataset, "collate_fn", None),
        pin_memory=device.type == "cuda",
    )

    all_emb: list[torch.Tensor] = []
    for batch in tqdm(loader, desc=desc, leave=False, dynamic_ncols=True):
        x, _labels, mask = batch
        x = x.to(device)
        if mask is not None:
            mask = mask.to(device)
        emb = model(x, mask)
        if torch.isnan(emb).any() or torch.isinf(emb).any():
            raise RuntimeError("Invalid embeddings (NaN/Inf) during collection")
        all_emb.append(emb.cpu())

    if not all_emb:
        raise RuntimeError("No embeddings collected")

    return torch.cat(all_emb, dim=0).numpy()
