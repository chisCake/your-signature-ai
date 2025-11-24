from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class AugmentationConfig:
    """Конфигурация аугментации данных"""

    time_warp_prob: float = 0.5
    time_warp_sigma: float = 0.3
    noise_prob: float = 0.5
    noise_sigma: float = 0.02
    rotation_prob: float = 0.3
    rotation_range: float = 8.0
    scale_prob: float = 0.3
    scale_range: List[float] = field(default_factory=lambda: [0.85, 1.15])
    dropout_prob: float = 0.2
    dropout_rate: float = 0.1
    time_resample_prob: float = 0.5
    resample_range: List[int] = field(default_factory=lambda: [200, 1000])
    pressure_prob: float = 0.4
    pressure_range: List[float] = field(default_factory=lambda: [0.8, 1.2])


@dataclass
class DatasetConfig:
    lmdb_path: str
    num_workers: int = 0
    batch_size: int = 64
    augment: bool = False
    augmentation: Optional[AugmentationConfig] = None
    max_sequence_length: int = 1024
    feature_pipeline: List[str] = field(
        default_factory=lambda: [
            "x",
            "y",
            "p",
            "vx",
            "vy",
            "speed",
            "ax",
            "ay",
            "acc_norm",
            "jerk",
            "curvature",
            "log_curvature_radius",
            "prate",
            "abs_delta_pressure",
            "path_tangent_angle",
            "bearing_angle",
            "norm_x",
            "norm_y",
            "pen_state",
            "stroke_id_sin",
            "stroke_id_cos",
        ]
    )
    dataset_sample_ratio: float = 1.0


@dataclass
class ModelConfig:
    name: str = "hybrid"
    embedding_dim: int = 256
    cnn_channels: List[int] = field(default_factory=lambda: [64, 128, 256])
    gru_hidden: int = 256
    gru_layers: int = 3
    dropout: float = 0.3


@dataclass
class TrainingConfig:
    epochs: int = 100
    learning_rate: float = 0.0005
    weight_decay: float = 3e-05
    mixed_precision: bool = True
    seed: int = 42
    device: Optional[str] = None
    # mining/loss
    loss_type: str = "triplet"
    triplet_margin: float = 0.3
    miner_type: str = "batch_all"
    mining_switch_stagnation_threshold: int = 7
    min_epochs_per_mining_phase: int = 5
    length_tolerance_ratio: Optional[float] = None
    mining_mode: str = "online"
    # PK sampler controls
    pk_p: int = 16
    pk_k: int = 8
    pk_epoch_multiplier: int = 4
    pk_use_all_data: bool = True
    # Gradient accumulation
    grad_accum_steps: int = 2
    # experiment control
    run_name: Optional[str] = None
    output_dir: str = "/content/drive/MyDrive/runs"
    resume: bool = True
    early_stopping_patience: int = 10
    # splits (per-user)
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    # split mode: if True, split by users (val/test users are disjoint from train users)
    split_by_users: bool = True
    # gradient clipping
    grad_clip_max_norm: float = 1.0
    # Learning rate scheduling
    warmup_epochs: int = 3
    lr_reduction_factor: float = 1.0
    # Logging
    log_frequency: int = 1
    # Legacy fields (auto-computed from output_dir + timestamp, kept for compatibility)
    checkpoint_dir: Optional[str] = None
    log_dir: Optional[str] = None
    export_dir: Optional[str] = None


@dataclass
class ExperimentConfig:
    dataset: DatasetConfig
    model: ModelConfig
    training: TrainingConfig
