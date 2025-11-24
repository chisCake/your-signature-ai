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
        same = labels == labels.t()  # (B, B)
        diff = ~same

        anchors, positives, negatives = [], [], []
        for i in range(B):
            pos_idx = torch.where(same[i])[0]
            neg_idx = torch.where(diff[i])[0]
            # remove self from positives
            pos_idx = pos_idx[pos_idx != i]
            if pos_idx.numel() == 0 or neg_idx.numel() == 0:
                continue

            pos_dists = dist[i][pos_idx]
            neg_dists = dist[i][neg_idx]

            if self.mode == "batch-all":
                # For every positive, choose hardest valid negative
                for pj, d_pos in zip(pos_idx, pos_dists):
                    candidate_mask = neg_dists > d_pos
                    if candidate_mask.any():
                        n_rel = torch.argmin(neg_dists + (~candidate_mask) * 1e6)
                    else:
                        n_rel = torch.argmin(neg_dists)
                    anchors.append(i)
                    positives.append(pj.item())
                    negatives.append(neg_idx[n_rel].item())
                continue

            # pick positive: nearest positive for semi-hard & hard
            p_rel = torch.argmin(pos_dists)
            p = pos_idx[p_rel]

            if self.mode == "semi-hard":
                d_pos = pos_dists[p_rel]
                candidate_mask = (neg_dists > d_pos) & (neg_dists < d_pos + self.margin)
                cand = torch.where(candidate_mask)[0]
                if cand.numel() > 0:
                    n_rel = cand[torch.randint(0, cand.numel(), (1,)).item()]
                else:
                    n_rel = torch.argmin(neg_dists)
                n = neg_idx[n_rel]
            else:  # hard
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
