"""
Data augmentation for signature trajectories.
"""
import torch
import random
from typing import Optional


class SignatureAugmentation:
    """
    Augmentation for signature time-series data.
    Applies random transformations to trajectory features while preserving signature characteristics.
    """
    
    def __init__(
        self,
        time_warp_prob: float = 0.3,
        time_warp_sigma: float = 0.2,
        noise_prob: float = 0.3,
        noise_sigma: float = 0.01,
        rotation_prob: float = 0.2,
        rotation_range: float = 5.0,  # degrees
        scale_prob: float = 0.2,
        scale_range: tuple = (0.9, 1.1),
        dropout_prob: float = 0.1,
        dropout_rate: float = 0.05,
        time_resample_prob: float = 0.3,  # NEW: prevent length-based discrimination
        resample_range: tuple = (300, 800),  # NEW: target length range
    ):
        """
        Args:
            time_warp_prob: Probability of applying time warping
            time_warp_sigma: Std dev for time warping (as fraction of sequence length)
            noise_prob: Probability of adding Gaussian noise
            noise_sigma: Std dev for Gaussian noise
            rotation_prob: Probability of rotating trajectory
            rotation_range: Max rotation angle in degrees
            scale_prob: Probability of scaling trajectory
            scale_range: (min, max) scale factors
            dropout_prob: Probability of applying point dropout
            dropout_rate: Fraction of points to drop
        """
        self.time_warp_prob = time_warp_prob
        self.time_warp_sigma = time_warp_sigma
        self.noise_prob = noise_prob
        self.noise_sigma = noise_sigma
        self.rotation_prob = rotation_prob
        self.rotation_range = rotation_range
        self.scale_prob = scale_prob
        self.scale_range = scale_range
        self.dropout_prob = dropout_prob
        self.dropout_rate = dropout_rate
        self.time_resample_prob = time_resample_prob
        self.resample_range = resample_range
    
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
        mask = (aug.abs().sum(dim=1) > 1e-6)
        seq_len = mask.sum().item()
        
        if seq_len < 2:
            return aug  # Too short to augment
        
        # 1. Time warping (smooth speed variations)
        if random.random() < self.time_warp_prob:
            aug = self._time_warp(aug, seq_len)
        
        # 2. Gaussian noise on spatial features
        if random.random() < self.noise_prob:
            aug = self._add_noise(aug, seq_len)
        
        # 3. Rotation (only for spatial features)
        if random.random() < self.rotation_prob:
            aug = self._rotate(aug, seq_len)
        
        # 4. Scaling (only for spatial features)
        if random.random() < self.scale_prob:
            aug = self._scale(aug, seq_len)
        
        # 5. Point dropout (simulate pen lifts or sensor noise)
        if random.random() < self.dropout_prob:
            aug = self._dropout(aug, seq_len)
        
        # 6. Time resampling (prevent length-based discrimination)
        if random.random() < self.time_resample_prob:
            aug = self._time_resample(aug, seq_len)
        
        return aug
    
    def _time_warp(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Apply smooth time warping by interpolating with warped indices.
        Simulates speed variations during writing.
        """
        # Create smooth warping function
        original_indices = torch.linspace(0, seq_len - 1, seq_len)
        warp = torch.randn(seq_len) * self.time_warp_sigma * seq_len
        warp = torch.cumsum(warp, dim=0)
        warp = warp - warp.mean()  # Center
        warped_indices = original_indices + warp
        warped_indices = torch.clamp(warped_indices, 0, seq_len - 1)
        
        # Interpolate features at warped positions
        # For simplicity, use nearest neighbor (could use linear interpolation)
        warped_indices = warped_indices.long()
        tensor[:seq_len] = tensor[warped_indices]
        
        return tensor
    
    def _add_noise(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Add Gaussian noise to spatial features (vx, vy, ax, ay).
        Assumes features 1-4 are velocity/acceleration.
        """
        # Add noise only to non-time features (skip dt at index 0)
        noise = torch.randn_like(tensor[:seq_len, 1:]) * self.noise_sigma
        tensor[:seq_len, 1:] += noise
        return tensor
    
    def _rotate(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Rotate trajectory by small angle.
        Assumes vx, vy are at indices 1, 2.
        """
        angle_deg = random.uniform(-self.rotation_range, self.rotation_range)
        angle_rad = angle_deg * 3.14159 / 180.0
        
        cos_a = torch.cos(torch.tensor(angle_rad))
        sin_a = torch.sin(torch.tensor(angle_rad))
        
        # Rotate velocity components (vx, vy at indices 1, 2)
        if tensor.size(1) >= 3:
            vx = tensor[:seq_len, 1].clone()
            vy = tensor[:seq_len, 2].clone()
            tensor[:seq_len, 1] = vx * cos_a - vy * sin_a
            tensor[:seq_len, 2] = vx * sin_a + vy * cos_a
        
        # Rotate acceleration if present (ax, ay at indices 3, 4)
        if tensor.size(1) >= 5:
            ax = tensor[:seq_len, 3].clone()
            ay = tensor[:seq_len, 4].clone()
            tensor[:seq_len, 3] = ax * cos_a - ay * sin_a
            tensor[:seq_len, 4] = ax * sin_a + ay * cos_a
        
        return tensor
    
    def _scale(self, tensor: torch.Tensor, seq_len: int) -> torch.Tensor:
        """
        Scale spatial features by random factor.
        """
        scale = random.uniform(*self.scale_range)
        # Scale velocity and acceleration (indices 1-4)
        if tensor.size(1) >= 5:
            tensor[:seq_len, 1:5] *= scale
        return tensor
    
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
        indices = torch.linspace(0, seq_len-1, target_len).long()
        resampled = tensor.clone()
        resampled[:target_len] = tensor[indices]
        resampled[target_len:] = 0
        
        return resampled


class NoAugmentation:
    """Identity augmentation (no-op) for validation/test sets."""
    
    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        return tensor

