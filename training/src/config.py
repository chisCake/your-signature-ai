from dataclasses import dataclass, field
from typing import Optional, List, Tuple


@dataclass
class AugmentationConfig:
    """Configuration for data augmentation parameters."""

    time_warp_prob: float = 0.45
    time_warp_sigma: float = 0.25
    noise_prob: float = 0.45
    noise_sigma: float = 0.015
    rotation_prob: float = 0.3
    rotation_range: float = 6.0
    scale_prob: float = 0.3
    scale_range: Tuple[float, float] = (0.88, 1.12)
    dropout_prob: float = 0.15
    dropout_rate: float = 0.07
    time_resample_prob: float = 0.4
    resample_range: Tuple[int, int] = (
        300,
        800,
    )  # Оставляем этот параметр без изменений
    pressure_prob: float = 0.35
    pressure_range: Tuple[float, float] = (0.85, 1.15)


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
    batch_size: int = (
        64  # PK-sampling P=8 K=8 => batch=64 (увеличено благодаря уменьшению max_sequence_length)
    )
    augment: bool = True
    augmentation: Optional[AugmentationConfig] = field(
        default_factory=AugmentationConfig
    )  # Augmentation parameters (used when augment=True)
    max_sequence_length: int = (
        1024  # Уменьшено с 2048 для экономии памяти и возможности увеличения batch_size
    )
    feature_pipeline: List[str] = field(
        default_factory=lambda: [
            "x",
            "y",
            "p",
            # "t", # попытка убрать время как признак
            # velocity and speed
            "vx",
            "vy",
            "speed",
            # acceleration
            "ax",
            "ay",
            "acc_norm",
            # jerk & curvature
            "jerk",
            "curvature",
            "log_curvature_radius",
            # pressure dynamics
            "prate",
            "abs_delta_pressure",
            # angles
            "path_tangent_angle",
            "bearing_angle",
            # normalized coords
            "norm_x",
            "norm_y",
            # pen/stroke info
            "pen_state",
            "stroke_id_sin",
            "stroke_id_cos",
        ]
    )
    # Dataset sampling for quick testing
    dataset_sample_ratio: Optional[float] = (
        None  # Use only part of dataset (e.g., 0.1 for 10%)
    )


@dataclass
class ModelConfig:
    name: str = "hybrid"
    embedding_dim: int = (
        256  # Увеличено с 128 для лучшего разделения пользователей  # Рекомендуемый размер эмбеддинга согласно плану
    )
    # Model architecture parameters
    cnn_channels: tuple = (64, 128, 256)
    gru_hidden: int = 256
    gru_layers: int = (
        3  # Возвращено к 3 для стабильности (4 слоя могут вызывать проблемы с градиентами)
    )
    dropout: float = 0.3


@dataclass
class TrainingConfig:
    epochs: int = 20  # Увеличено для лучшего обучения
    learning_rate: float = (
        0.0003  # Уменьшено для более глубокой архитектуры (3 conv + 3 GRU)
    )
    weight_decay: float = 3e-05  # Рекомендуемый weight decay
    mixed_precision: bool = True  # AMP для экономии VRAM
    seed: int = 42
    device: Optional[str] = None
    # mining/loss
    loss_type: str = "triplet"  # "triplet" | "contrastive"
    triplet_margin: float = 0.3  # Увеличено с 0.2 до 0.3 для лучшего разделения классов
    miner_type: Optional[str] = (
        "batch_all"  # None = adaptive (semi-hard→hard→batch-all) | "hard" = hard→batch-all | "batch_all" = batch-all only
    )
    # Adaptive mining phase switching
    mining_switch_stagnation_threshold: int = (
        7  # Number of stagnation epochs before switching mining phase
    )
    min_epochs_per_mining_phase: int = (
        5  # Minimum epochs in a phase before allowing switch
    )
    # Optional: restrict negatives to similar-length sequences (ratio of anchor length)
    length_tolerance_ratio: float | None = None  # Отключено для лучшего обучения
    mining_mode: str = "online"  # "online" | "offline"
    # PK sampler controls
    pk_p: int = 8  # Users per batch
    pk_k: int = 8  # Samples per user
    pk_epoch_multiplier: int = 4  # Repeat identities N times per epoch to use more data
    pk_use_all_data: bool = (
        True  # When True, systematically cycles through all samples to use 100% of data
    )
    grad_accum_steps: int = 2  # Gradient accumulation
    # experiment control
    run_name: Optional[str] = None
    output_dir: str = (
        "./outputs"  # Base output directory, will create timestamped subdirs
    )
    resume: bool = True
    early_stopping_patience: int = (
        15  # Increased to give more time after miner mode transitions
    )
    # splits (per-user)
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    # split mode: if True, split by users (val/test users are disjoint from train users)
    split_by_users: bool = True
    # gradient clipping
    grad_clip_max_norm: float = (
        0.5  # Усилен для более глубокой архитектуры (предотвращение взрыва градиентов)
    )
    # Learning rate scheduling
    warmup_epochs: int = 3  # Number of epochs for LR warmup
    # lr_reduction_factor deprecated (no manual LR changes)
    lr_reduction_factor: float = 1.0

    # Logging
    log_frequency: int = (
        1  # Частота логгирования (каждые N батчей, по умолчанию каждый батч)
    )

    # Legacy fields (auto-computed from output_dir + timestamp, kept for compatibility)
    checkpoint_dir: Optional[str] = None
    log_dir: Optional[str] = None
    plot_dir: Optional[str] = None


@dataclass
class ExperimentConfig:
    dataset: DatasetConfig
    model: ModelConfig
    training: TrainingConfig
