from typing import Callable, Optional, Tuple, List, Dict
import io
import lmdb
import csv
import numpy as np
import torch
from torch.utils.data import Dataset


class LmdbSignatureDataset(Dataset):
    """
    LMDB-backed dataset for signature verification experiments.
    Works with CSV coordinate data instead of images.

    LMDB layout (created by workflows.build_dataset):
      - key "__index__" -> bytes of newline-separated sample keys
      - for each sample key K:
          - K            -> CSV data (t,x,y,p,...) as text
          - f"{K}:label" -> ASCII label (e.g., "genuine" | "forged")
          - f"{K}:user_code" -> user ID for triplet learning
    """

    def __init__(
        self,
        lmdb_path: str,
        max_sequence_length: int = 1000,
        feature_pipeline: Optional[List[str]] = None,
        transform: Optional[Callable] = None,
        return_user_code: bool = False,
    ) -> None:
        from .features import apply_feature_pipeline  # local import to avoid circular

        self.lmdb_path = lmdb_path
        self.max_sequence_length = max_sequence_length
        self.feature_pipeline = feature_pipeline or ["t", "x", "y", "p"]
        self._apply_features = apply_feature_pipeline

        self.env = lmdb.open(
            lmdb_path, readonly=True, lock=False, readahead=True, max_readers=2048
        )

        with self.env.begin() as txn:
            index_bytes = txn.get(b"__index__")
            if index_bytes is None:
                raise RuntimeError(f"LMDB index not found at {lmdb_path}")
            self.keys = [k for k in index_bytes.decode("utf-8").splitlines() if k]

        self.transform = transform
        self.return_user_code = return_user_code

        # Build deterministic user_code -> user_id mapping without collisions
        self._user_code_to_id: Dict[str, int] = {}
        self._build_user_mapping()

    def __len__(self) -> int:
        return len(self.keys)

    def __getitem__(
        self, index: int
    ) -> (
        Tuple[torch.Tensor, torch.Tensor, int]
        | Tuple[torch.Tensor, torch.Tensor, int, str]
    ):
        """
        Returns:
            tensor: (T, F) feature tensor
            mask: (T,) boolean mask for valid tokens
            user_id: integer user ID for triplet learning
            user_code: (optional) string user code
        """
        key = self.keys[index]
        with self.env.begin() as txn:
            csv_bytes = txn.get(key.encode("utf-8"))
            if csv_bytes is None:
                raise KeyError(f"Missing CSV data for key {key}")
            label_bytes = txn.get(f"{key}:label".encode("utf-8"))
            label = label_bytes.decode("utf-8") if label_bytes else ""
            user_code_bytes = txn.get(f"{key}:user_code".encode("utf-8"))
            user_code = user_code_bytes.decode("utf-8") if user_code_bytes else ""

        # Parse CSV data
        csv_text = csv_bytes.decode("utf-8")
        reader = csv.reader(csv_text.strip().split("\n"))
        rows = list(reader)

        if len(rows) < 2:  # Need header + at least one data row
            # Return empty tensor if no data
            empty = torch.zeros(
                (self.max_sequence_length, len(self.feature_pipeline)),
                dtype=torch.float32,
            )
            mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
            user_id = self._get_user_id(user_code)
            return (
                (empty, mask, user_id, user_code)
                if self.return_user_code
                else (empty, mask, user_id)
            )

        # Skip header row, parse data
        data_rows = rows[1:] if len(rows) > 1 else []

        # Parse coordinates and pressure
        coordinates = []
        for row in data_rows:
            if len(row) >= 4:  # t, x, y, p
                try:
                    t = float(row[0])
                    x = float(row[1])
                    y = float(row[2])
                    p = float(row[3])
                    coordinates.append([t, x, y, p])
                except (ValueError, IndexError):
                    continue

        if not coordinates:
            empty = torch.zeros(
                (self.max_sequence_length, len(self.feature_pipeline)),
                dtype=torch.float32,
            )
            mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
            user_id = self._get_user_id(user_code)
            return (
                (empty, mask, user_id, user_code)
                if self.return_user_code
                else (empty, mask, user_id)
            )

        # Convert to numpy array
        coords_array = np.array(coordinates, dtype=np.float32)
        original_len = len(coords_array)

        # Check for extreme values in raw data
        if np.isnan(coords_array).any() or np.isinf(coords_array).any():
            print(
                f"Warning: NaN/Inf detected in raw data for user {user_code}. Replacing with zeros."
            )
            coords_array = np.nan_to_num(coords_array, nan=0.0, posinf=0.0, neginf=0.0)

        # Clip extreme values in raw coordinates
        coords_array = np.clip(coords_array, -1e6, 1e6)

        # Truncate or pad to max_sequence_length
        if len(coords_array) > self.max_sequence_length:
            # Truncate long sequences
            coords_array = coords_array[: self.max_sequence_length]
            original_len = self.max_sequence_length  # Update original_len for mask
        elif len(coords_array) < self.max_sequence_length:
            # Pad short sequences
            padding_needed = self.max_sequence_length - len(coords_array)
            padding = np.zeros(
                (padding_needed, coords_array.shape[1]), dtype=np.float32
            )
            coords_array = np.vstack([coords_array, padding])

        # Convert to tensor
        tensor = torch.from_numpy(coords_array)

        # Apply feature pipeline
        tensor = self._apply_features(
            tensor,
            pipeline=self.feature_pipeline,
        )

        # Create mask for valid tokens
        mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
        if original_len > 0:
            mask[: min(original_len, self.max_sequence_length)] = True

        # Apply transform if provided
        if self.transform is not None:
            tensor = self.transform(tensor)

        # Convert user_code to integer user_id for triplet learning
        user_id = self._get_user_id(user_code)

        if self.return_user_code:
            return tensor, mask, user_id, user_code
        return tensor, mask, user_id

    def get_user_code(self, index: int) -> str:
        """Fast path to retrieve *only* the ``user_code`` for a sample.

        This avoids parsing the CSV or doing any heavy processing – we simply
        open a read-only LMDB transaction and fetch the ``<key>:user_code``
        value.  It is ~10-20× faster than calling ``__getitem__`` when we only
        need the identifier (e.g. while building train/val/test splits).

        Args:
            index: Sample index in ``self.keys``

        Returns:
            Decoded user_code string (empty string if missing).
        """
        key = self.keys[index]
        with self.env.begin() as txn:
            user_code_bytes = txn.get(f"{key}:user_code".encode("utf-8"))
        return user_code_bytes.decode("utf-8") if user_code_bytes else ""

    def _build_user_mapping(self):
        """Build deterministic user_code -> user_id mapping without collisions.

        Uses single LMDB transaction for efficiency and creates a deterministic
        mapping by sorting user codes alphabetically. This ensures:
        1. No hash collisions between different users
        2. Consistent user_id for same user_code across runs
        3. O(1) lookup time during training
        """
        unique_codes = set()

        # Single transaction for all keys (much faster than per-key transactions)
        with self.env.begin() as txn:
            for key in self.keys:
                user_code_bytes = txn.get(f"{key}:user_code".encode("utf-8"))
                if user_code_bytes:
                    unique_codes.add(user_code_bytes.decode("utf-8"))

        # Sort for determinism (same order across runs)
        sorted_codes = sorted(unique_codes)

        # Create mapping: user_code -> sequential integer ID (0, 1, 2, ...)
        for idx, code in enumerate(sorted_codes):
            self._user_code_to_id[code] = idx

    def _get_user_id(self, user_code: str) -> int:
        """Convert user_code string to integer user_id for triplet learning.

        Uses pre-built deterministic mapping to avoid hash collisions.

        Args:
            user_code: String user code from dataset

        Returns:
            Integer user ID (0-indexed, no collisions guaranteed)
        """
        if not user_code:
            return 0

        # Use deterministic mapping (no collisions)
        return self._user_code_to_id.get(user_code, 0)

    @staticmethod
    def collate_fn(batch):
        """
        Custom collate function for DataLoader.
        All sequences are already padded/truncated to max_sequence_length.
        Returns:
            x_batch: (B, T_max, F) tensor
            labels: (B,) tensor of user_ids
            mask: (B, T_max) boolean mask
        """
        # Handle both 3-tuple and 4-tuple returns from __getitem__
        if len(batch[0]) == 4:
            tensors, masks, user_ids, user_codes = zip(*batch)
        else:
            tensors, masks, user_ids = zip(*batch)

        # Stack tensors (all have same size now)
        x_batch = torch.stack(tensors, dim=0)  # (B, T_max, F)
        mask = torch.stack(masks, dim=0)  # (B, T_max)
        labels = torch.tensor(user_ids, dtype=torch.long)  # (B,)

        return x_batch, labels, mask
