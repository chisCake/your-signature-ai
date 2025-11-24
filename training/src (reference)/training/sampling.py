from __future__ import annotations

from typing import Dict, List, Iterable
import random
from torch.utils.data import Sampler


class PKSampler(Sampler[int]):
    """
    Class-balanced (per-identity) sampler: each batch contains P identities and K samples per identity.
    Requires the dataset to provide a `user_code` per index via a parallel list.

    With epoch_multiplier > 1, identities are repeated multiple times per epoch to use
    more data. When use_all_data=True, ensures all samples are used at least once per epoch
    by distributing remaining samples across batches while maintaining PK structure.
    """

    def __init__(
        self,
        labels: List[str],
        P: int,
        K: int,
        shuffle_identities: bool = True,
        epoch_multiplier: int = 1,
        use_all_data: bool = True,
    ) -> None:
        super().__init__(None)
        self.labels = labels
        self.P = P
        self.K = K
        self.shuffle_identities = shuffle_identities
        self.epoch_multiplier = epoch_multiplier
        self.use_all_data = use_all_data

        # map label -> indices
        self.label_to_indices: Dict[str, List[int]] = {}
        for idx, lab in enumerate(labels):
            self.label_to_indices.setdefault(lab, []).append(idx)

        # only identities with enough samples (or repeat if fewer)
        self.identities: List[str] = list(self.label_to_indices.keys())

    def __iter__(self) -> Iterable[List[int]]:
        # Prepare per-identity sample pools for this epoch
        # When use_all_data=True, we'll cycle through all samples systematically
        identity_pools: Dict[str, List[int]] = {}
        identity_positions: Dict[str, int] = {}

        for identity in self.identities:
            pool = self.label_to_indices[identity][:]
            if self.shuffle_identities:
                random.shuffle(pool)
            identity_pools[identity] = pool
            identity_positions[identity] = 0

        # Repeat identities to use more data per epoch
        ids = self.identities * self.epoch_multiplier

        if self.shuffle_identities:
            random.shuffle(ids)

        # Generate batches
        for i in range(0, len(ids), self.P):
            group = ids[i : i + self.P]
            batch: List[int] = []

            for g in group:
                pool = identity_pools[g]
                position = identity_positions[g]

                if self.use_all_data and len(pool) > 0:
                    # Cycle through all samples systematically
                    # Take K samples starting from current position
                    picks = []
                    for _ in range(self.K):
                        if position >= len(pool):
                            position = 0  # Wrap around
                        picks.append(pool[position])
                        position += 1
                    identity_positions[g] = position
                else:
                    # Original behavior: random sampling
                    if len(pool) >= self.K:
                        picks = random.sample(pool, self.K)
                    else:
                        # repeat to fill
                        mult = (self.K + len(pool) - 1) // len(pool)
                        expanded = (pool * mult)[: self.K]
                        random.shuffle(expanded)
                        picks = expanded

                batch.extend(picks)

            yield batch

    def __len__(self) -> int:
        # number of PK groups (i.e. number of batches)
        # accounts for epoch_multiplier: more batches per epoch
        total_identities = len(self.identities) * self.epoch_multiplier
        groups = (total_identities + self.P - 1) // self.P
        return groups
