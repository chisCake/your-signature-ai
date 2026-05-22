"""
Data augmentation for signature trajectories.
"""

import math
import random
from typing import Optional, List

import torch
from config import AugmentationConfig


class SignatureAugmentation:
    """
    Augmentation for signature time-series data.
    Applies random transformations to trajectory features while preserving signature characteristics.
    """

    def __init__(
        self,
        feature_pipeline: list[str],
        config: Optional[AugmentationConfig] = None,
    ):
        """
        Args:
            feature_pipeline: List of feature names, used to find correct indices for augmentations.
            config: AugmentationConfig object with augmentation parameters.
                    If None, uses default AugmentationConfig.
        """
        if config is None:
            config = AugmentationConfig()

        # Store feature indices
        self.feature_map = {name: i for i, name in enumerate(feature_pipeline)}
        self.x_idx = self.feature_map.get("x")
        self.y_idx = self.feature_map.get("y")
        self.norm_x_idx = self.feature_map.get("norm_x")
        self.norm_y_idx = self.feature_map.get("norm_y")
        self.vx_idx = self.feature_map.get("vx")
        self.vy_idx = self.feature_map.get("vy")
        self.ax_idx = self.feature_map.get("ax")
        self.ay_idx = self.feature_map.get("ay")
        self.p_idx = self.feature_map.get("p")

        self.time_warp_prob = config.time_warp_prob
        self.time_warp_sigma = config.time_warp_sigma
        self.time_warp_max_compression = getattr(
            config, "time_warp_max_compression", config.time_warp_sigma
        )
        self.noise_prob = config.noise_prob
        self.noise_sigma = config.noise_sigma
        self.jitter_prob = getattr(config, "jitter_prob", config.noise_prob)
        self.jitter_sigma = getattr(config, "jitter_sigma", config.noise_sigma)
        self.rotation_prob = config.rotation_prob
        self.rotation_range = config.rotation_range
        self.scale_prob = config.scale_prob
        self.scale_range = config.scale_range
        self.affine_prob = getattr(config, "affine_prob", config.rotation_prob)
        self.affine_rotation_deg = getattr(
            config, "affine_rotation_deg", config.rotation_range
        )
        self.affine_scale_range: List[float] = getattr(
            config, "affine_scale_range", config.scale_range
        )
        self.dropout_prob = config.dropout_prob
        self.dropout_rate = config.dropout_rate
        self.time_resample_prob = config.time_resample_prob
        self.resample_range = config.resample_range
        self.pressure_prob = config.pressure_prob
        self.pressure_range = config.pressure_range
        self._pos_pairs = [
            (self.x_idx, self.y_idx),
            (self.norm_x_idx, self.norm_y_idx),
        ]
        self._vector_pairs = [
            (self.vx_idx, self.vy_idx),
            (self.ax_idx, self.ay_idx),
        ]
        angle_indices: List[int] = []
        for feature in ["path_tangent_angle", "bearing_angle"]:
            idx = self.feature_map.get(feature)
            if idx is not None:
                angle_indices.append(idx)
        self._angle_indices = angle_indices
        jitter_indices = []
        for idx in [
            self.x_idx,
            self.y_idx,
            self.norm_x_idx,
            self.norm_y_idx,
            self.vx_idx,
            self.vy_idx,
        ]:
            if idx is not None:
                jitter_indices.append(idx)
        self._jitter_indices = jitter_indices

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        """
        Apply random augmentations to signature tensor.

        Args:
            tensor: Input tensor of shape [seq_len, num_features]
                    Features typically: [dt, vx, vy, ax, ay, prate, ...]

        Returns:
            Augmented tensor of same shape
        """
        # Work on a copy
        aug = tensor.clone()

        # Find non-zero length (where padding starts)
        # Assume features are 0 after actual signature ends
        mask = aug.abs().sum(dim=1) > 1e-6
        seq_len = mask.sum().item()

        if seq_len < 2:
            return aug  # Too short to augment

        # 1. Time warping (smooth speed variations)
        if random.random() < self.time_warp_prob:
            aug = self._time_warp(aug, seq_len)

        # 2. Random affine (rotation + anisotropic scaling)
        if random.random() < self.affine_prob:
            aug = self._random_affine(aug, seq_len)

        # 3. Coordinate jitter (Gaussian noise on spatial dynamics)
        if random.random() < self.jitter_prob:
            aug = self._jitter(aug, seq_len)

        # 5. Point dropout (simulate pen lifts or sensor noise)
        if random.random() < self.dropout_prob:
            aug = self._dropout(aug, seq_len)

        # 6. Time resampling (prevent length-based discrimination)
        if random.random() < self.time_resample_prob:
            aug = self._time_resample(aug, seq_len)

        # 7. Pressure variation (simulate different pen pressure)
        if random.random() < self.pressure_prob:
            aug = self._pressure_variation(aug, seq_len)

        return aug

    def _time_warp(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Apply smooth time warping by re-sampling the sequence with monotonic perturbations.
        """
        if seq_len <= 3:
            return tensor

        base = tensor[:seq_len].clone()
        device = tensor.device
        dtype = tensor.dtype
        timeline = torch.linspace(0.0, 1.0, seq_len, device=device, dtype=dtype)
        noise = torch.empty_like(timeline).uniform_(
            -self.time_warp_max_compression, self.time_warp_max_compression
        )
        warped = torch.clamp(timeline + noise, 0.0, 1.0)
        warped, _ = torch.sort(warped)
        scaled = warped * (seq_len - 1)

        lower = torch.floor(scaled).long()
        upper = torch.clamp(lower + 1, max=seq_len - 1)
        frac = (scaled - lower.float()).unsqueeze(-1)

        tensor[:seq_len] = base[lower] * (1 - frac) + base[upper] * frac
        return tensor

    def _jitter(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """Add gaussian noise to coordinate-like channels."""
        if not self._jitter_indices:
            return tensor
        noise = torch.randn(
            seq_len,
            len(self._jitter_indices),
            device=tensor.device,
            dtype=tensor.dtype,
        ) * self.jitter_sigma
        tensor[:seq_len, self._jitter_indices] += noise
        return tensor

    def _random_affine(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """Apply coupled rotation + anisotropic scaling to spatial dynamics."""
        angle_deg = random.uniform(-self.affine_rotation_deg, self.affine_rotation_deg)
        angle_rad = math.radians(angle_deg)
        sx = random.uniform(*self.affine_scale_range)
        sy = random.uniform(*self.affine_scale_range)

        rot = torch.tensor(
            [
                [math.cos(angle_rad), -math.sin(angle_rad)],
                [math.sin(angle_rad), math.cos(angle_rad)],
            ],
            device=tensor.device,
            dtype=tensor.dtype,
        )
        scale = torch.tensor(
            [[sx, 0.0], [0.0, sy]], device=tensor.device, dtype=tensor.dtype
        )
        matrix = scale @ rot

        def _apply_pair(idx_a: Optional[int], idx_b: Optional[int]):
            if idx_a is None or idx_b is None:
                return
            segment = tensor[:seq_len, [idx_a, idx_b]]
            transformed = segment @ matrix.T
            tensor[:seq_len, idx_a] = transformed[:, 0]
            tensor[:seq_len, idx_b] = transformed[:, 1]

        for pair in self._pos_pairs + self._vector_pairs:
            _apply_pair(*pair)

        # Adjust magnitude-only channels proportionally
        avg_scale = (abs(sx) + abs(sy)) / 2.0
        for mag_feature in ["speed", "acc_norm", "path_velocity"]:
            idx = self.feature_map.get(mag_feature)
            if idx is not None:
                tensor[:seq_len, idx] *= avg_scale

        self._adjust_angle_channels(tensor, seq_len, angle_rad)
        return tensor

    def _adjust_angle_channels(
        self, tensor: torch.Tensor, seq_len: int, angle_rad: float
    ) -> None:
        """Shift angular channels after affine transforms."""
        if not self._angle_indices:
            return
        delta = angle_rad / math.pi
        updated = torch.clamp(
            tensor[:seq_len, self._angle_indices] + delta, min=-1.0, max=1.0
        )
        tensor[:seq_len, self._angle_indices] = updated

    def _dropout(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Randomly drop some points (set to zero).
        Simulates sensor noise or pen lifts.
        """
        num_drop = int(seq_len * self.dropout_rate)
        if num_drop > 0:
            drop_indices = torch.randperm(seq_len)[:num_drop]
            tensor[drop_indices] = 0.0
        return tensor

    def _time_resample(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Resample sequence to random length to prevent length-based discrimination.
        This prevents the model from using sequence length as a primary feature.
        """
        if seq_len < 10:
            return tensor

        target_len = random.randint(*self.resample_range)
        if target_len >= seq_len:
            return tensor

        # Uniform sampling of indices
        indices = torch.linspace(0, seq_len - 1, target_len).long()
        resampled = tensor.clone()
        resampled[:target_len] = tensor[indices]
        resampled[target_len:] = 0

        return resampled

    def _pressure_variation(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Vary pressure values to simulate different pen pressure.
        """
        if self.p_idx is not None:
            pressure_scale = random.uniform(*self.pressure_range)
            # Apply to pressure feature
            tensor[:seq_len, self.p_idx] *= pressure_scale
        return tensor


class NoAugmentation:
    """Identity augmentation (no-op) for validation/test sets."""

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        return tensor
