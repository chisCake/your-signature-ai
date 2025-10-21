from __future__ import annotations

from typing import Dict, List, Iterable
import random
from torch.utils.data import Sampler


class PKSampler(Sampler[int]):
    """
    Class-balanced (per-identity) sampler: each batch contains P identities and K samples per identity.
    Requires the dataset to provide a `user_code` per index via a parallel list.
    """

    def __init__(self, labels: List[str], P: int, K: int, shuffle_identities: bool = True) -> None:
        super().__init__(None)
        self.labels = labels
        self.P = P
        self.K = K
        self.shuffle_identities = shuffle_identities

        # map label -> indices
        self.label_to_indices: Dict[str, List[int]] = {}
        for idx, lab in enumerate(labels):
            self.label_to_indices.setdefault(lab, []).append(idx)

        # only identities with enough samples (or repeat if fewer)
        self.identities: List[str] = list(self.label_to_indices.keys())

    def __iter__(self) -> Iterable[List[int]]:
        ids = self.identities[:]
        if self.shuffle_identities:
            random.shuffle(ids)
        
        for i in range(0, len(ids), self.P):
            group = ids[i:i + self.P]
            batch: List[int] = []
            for g in group:
                pool = self.label_to_indices[g]
                if len(pool) >= self.K:
                    picks = random.sample(pool, self.K)
                else:
                    # repeat to fill
                    mult = (self.K + len(pool) - 1) // len(pool)
                    expanded = (pool * mult)[:self.K]
                    random.shuffle(expanded)
                    picks = expanded
                batch.extend(picks)
            yield batch

    def __len__(self) -> int:
        # number of PK groups (i.e. number of batches)
        groups = (len(self.identities) + self.P - 1) // self.P
        return groups


