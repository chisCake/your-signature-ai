from typing import Callable, Optional, Tuple, List
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
          - f"{K}:input_type" -> input type ("mouse" | "touch" | "pen")
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

        self.num_channels: int = len(self.feature_pipeline)

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

    def __len__(self) -> int:
        return len(self.keys)

    def __getitem__(self, index: int) -> Tuple[torch.Tensor, str] | Tuple[torch.Tensor, str, str]:
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
        reader = csv.reader(csv_text.strip().split('\n'))
        rows = list(reader)
        
        if len(rows) < 2:  # Need header + at least one data row
            # Return empty tensor if no data
            empty = torch.zeros((self.max_sequence_length, 4), dtype=torch.float32)
            mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
            return (empty, mask, label, user_code) if self.return_user_code else (empty, mask, label)
        
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
            empty = torch.zeros((self.max_sequence_length, 4), dtype=torch.float32)
            mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
            return (empty, mask, label, user_code) if self.return_user_code else (empty, mask, label)
        
        # Convert to numpy array
        coords_array = np.array(coordinates, dtype=np.float32)
        original_len = len(coords_array)
        
        # --- MODIFIED: Pad ONLY, do not truncate ---
        # This prevents the model from using sequence length as a feature.
        # All sequences will have the same length, forcing the model to
        # learn from the trajectory data itself.
        if len(coords_array) < self.max_sequence_length:
            # Pad with zeros
            padding_needed = self.max_sequence_length - len(coords_array)
            # Ensure padding has same number of columns as data
            padding = np.zeros((padding_needed, coords_array.shape[1]), dtype=np.float32)
            coords_array = np.vstack([coords_array, padding])
        
        # Convert to tensor
        tensor = torch.from_numpy(coords_array)
        
        # Build derived features (x,y,p are already normalized in build_dataset.py)
        tensor = self._apply_features(
            tensor,
            pipeline=self.feature_pipeline,
        )

        # Create a mask for the padded sequence
        mask = torch.zeros(self.max_sequence_length, dtype=torch.bool)
        if original_len > 0:
            mask[:min(original_len, self.max_sequence_length)] = True


        # Apply transform if provided
        if self.transform is not None:
            tensor = self.transform(tensor)

        if self.return_user_code:
            return tensor, mask, label, user_code
        return tensor, mask, label


