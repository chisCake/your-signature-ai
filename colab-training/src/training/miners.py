# src/training/miners.py
import torch
import torch.nn as nn

class TripletMiner:
    """Simple online miner producing (anchor, positive, negative) tensors.
       Mode: 'semi-hard' or 'hard'."""
    def __init__(self, mode: str = "semi-hard", margin: float = 0.2):
        assert mode in ("semi-hard", "hard", "batch-all")
        self.mode = mode
        self.margin = margin

    def set_mode(self, mode: str):
        self.mode = mode

    def __call__(self, embeddings: torch.Tensor, labels: torch.Tensor):
        """
        embeddings: (B, D)
        labels: (B,) integers
        returns: (anchor, positive, negative) each shape (N_triplets, D)
        """
        device = embeddings.device
        B = embeddings.size(0)
        # Pairwise distance matrix
        dist = torch.cdist(embeddings, embeddings, p=2)  # (B, B)
        labels = labels.view(-1, 1)
        same = (labels == labels.t())  # (B, B)
        diff = ~same

        anchors, positives, negatives = [], [], []
        for i in range(B):
            pos_idx = torch.where(same[i])[0]
            neg_idx = torch.where(diff[i])[0]
            # remove self
            pos_idx = pos_idx[pos_idx != i]
            if pos_idx.numel() == 0 or neg_idx.numel() == 0:
                continue
            pos_dists = dist[i][pos_idx]
            neg_dists = dist[i][neg_idx]
            # pick positive: nearest positive (easy choice)
            p_rel = torch.argmin(pos_dists)
            p = pos_idx[p_rel]
            if self.mode == "semi-hard":
                # semi-hard: neg such that d_pos < d_neg < d_pos + margin
                d_pos = pos_dists[p_rel]
                candidate_mask = (neg_dists > d_pos) & (neg_dists < d_pos + self.margin)
                cand = torch.where(candidate_mask)[0]
                if cand.numel() > 0:
                    n_rel = cand[torch.randint(0, cand.numel(), (1,)).item()]
                    n = neg_idx[n_rel]
                else:
                    # fallback to hardest neg
                    n_rel = torch.argmin(neg_dists)
                    n = neg_idx[n_rel]
            elif self.mode == "hard":
                # hardest negative (nearest negative)
                n_rel = torch.argmin(neg_dists)
                n = neg_idx[n_rel]
            else:  # batch-all
                # produce multiple triplets per anchor (not implemented heavy)
                n_rel = torch.argmin(neg_dists)
                n = neg_idx[n_rel]

            anchors.append(i)
            positives.append(p.item())
            negatives.append(n.item())

        if len(anchors) == 0:
            # fallback: random triplet
            return embeddings, embeddings, embeddings
        a = embeddings[anchors]
        p = embeddings[positives]
        n = embeddings[negatives]
        return a, p, n