from __future__ import annotations

from typing import Tuple
import torch


class SemiHardMiner:
    """
    Online semi-hard triplet miner (FaceNet-style): for each anchor, choose a positive with higher distance than easy positives,
    and a negative that is harder than positives but still violates margin.
    Expects embeddings [B, D] and labels [B]. Returns (anchor_idx, pos_idx, neg_idx) tensors.

    Optionally supports length-aware negative selection via `lengths` and `length_tolerance_ratio`.
    """

    def __init__(self, margin: float = 0.2, length_tolerance_ratio: float | None = None):
        self.margin = margin
        self.length_tolerance_ratio = length_tolerance_ratio

    @torch.no_grad()
    def __call__(
        self,
        emb: torch.Tensor,
        labels: torch.Tensor,
        lengths: torch.Tensor | None = None,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        # {ИЗМЕНЕНО: Euclidean distance}/{майнеры должны работать с raw embeddings}/{mining будет согласован с loss function}
        dist = torch.cdist(emb, emb, p=2)  # [B, B]
        B = emb.size(0)
        device = emb.device

        anchors = []
        positives = []
        negatives = []

        for i in range(B):
            mask_pos = labels == labels[i]
            mask_neg = labels != labels[i]
            if lengths is not None and self.length_tolerance_ratio is not None:
                tol = max(1.0, float(self.length_tolerance_ratio) * float(lengths[i]))
                similar_len = torch.abs(lengths - lengths[i]) <= tol
                mask_neg = mask_neg & similar_len
            pos_dist = dist[i][mask_pos]
            neg_dist = dist[i][mask_neg]
            if pos_dist.numel() < 2 or neg_dist.numel() == 0:
                continue
            ap_dist = pos_dist.max()  # semi-hard: pick a relatively hard positive
            # negatives harder than ap, but still within margin violation
            valid_negs = neg_dist[(neg_dist < ap_dist + self.margin) & (neg_dist > ap_dist)]
            if valid_negs.numel() == 0:
                # fallback: pick the closest negative to the anchor among all negatives
                neg_choice = torch.argmin(neg_dist)
            else:
                neg_choice = torch.argmin(valid_negs)

            # map back to global indices
            pos_idx_global = torch.arange(B, device=device)[mask_pos][torch.argmax(pos_dist)]
            neg_idx_global = torch.arange(B, device=device)[mask_neg][neg_choice]

            anchors.append(i)
            positives.append(int(pos_idx_global))
            negatives.append(int(neg_idx_global))

        if len(anchors) == 0:
            return (torch.empty(0, dtype=torch.long, device=device),) * 3
        return (
            torch.tensor(anchors, dtype=torch.long, device=device),
            torch.tensor(positives, dtype=torch.long, device=device),
            torch.tensor(negatives, dtype=torch.long, device=device),
        )


class HardMiner:
    """Online hard miner: hardest positive and hardest negative (closest negative)."""

    def __init__(self, margin: float = 0.2, length_tolerance_ratio: float | None = None):
        self.margin = margin
        self.length_tolerance_ratio = length_tolerance_ratio

    @torch.no_grad()
    def __call__(
        self,
        emb: torch.Tensor,
        labels: torch.Tensor,
        lengths: torch.Tensor | None = None,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        # Euclidean distance (L2 norm) - works with raw embeddings
        dist = torch.cdist(emb, emb, p=2)  # [B, B]
        B = emb.size(0)
        device = emb.device

        anchors = []
        positives = []
        negatives = []
        for i in range(B):
            mask_pos = labels == labels[i]
            mask_neg = labels != labels[i]
            if lengths is not None and self.length_tolerance_ratio is not None:
                tol = max(1.0, float(self.length_tolerance_ratio) * float(lengths[i]))
                similar_len = torch.abs(lengths - lengths[i]) <= tol
                mask_neg = mask_neg & similar_len
            pos_dist = dist[i][mask_pos]
            neg_dist = dist[i][mask_neg]
            if pos_dist.numel() < 2 or neg_dist.numel() == 0:
                continue
            pos_idx_global = torch.arange(B, device=device)[mask_pos][torch.argmax(pos_dist)]
            neg_idx_global = torch.arange(B, device=device)[mask_neg][torch.argmin(neg_dist)]
            anchors.append(i)
            positives.append(int(pos_idx_global))
            negatives.append(int(neg_idx_global))
        if len(anchors) == 0:
            return (torch.empty(0, dtype=torch.long, device=device),) * 3
        return (
            torch.tensor(anchors, dtype=torch.long, device=device),
            torch.tensor(positives, dtype=torch.long, device=device),
            torch.tensor(negatives, dtype=torch.long, device=device),
        )


