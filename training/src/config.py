from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class DatasetConfig:
    lmdb_path: str
    num_workers: int = 0
    batch_size: int = 64  # PK-sampling P=8 K=8 => batch=64 (увеличено благодаря уменьшению max_sequence_length)
    augment: bool = True
    max_sequence_length: int = 1024  # Уменьшено с 2048 для экономии памяти и возможности увеличения batch_size
    feature_pipeline: List[str] = field(default_factory=lambda: [
        "vx", "vy", "ax", "ay", "prate", "path_tangent_angle", "abs_delta_pressure"
        # Рекомендуемые производные признаки согласно плану
    ])
    # Dataset sampling for quick testing
    dataset_sample_ratio: Optional[float] = None  # Use only part of dataset (e.g., 0.1 for 10%)


@dataclass
class ModelConfig:
    name: str = "hybrid"
    embedding_dim: int = 256  # Увеличено с 128 для лучшего разделения пользователей  # Рекомендуемый размер эмбеддинга согласно плану
    # Model architecture parameters
    cnn_channels: Optional[tuple] = None  # Будет установлено в (64, 128) по умолчанию
    gru_hidden: int = 256  # Размер скрытого слоя GRU
    gru_layers: int = 3  # Увеличено с 2 для лучшего моделирования временных зависимостей
    dropout: float = 0.2  # Уменьшено с 0.3 для сохранения большего количества информации


@dataclass
class TrainingConfig:
    epochs: int = 20  # Увеличено для лучшего обучения
    learning_rate: float = 0.0005  # Уменьшено с 0.001 для более стабильного обучения
    weight_decay: float = 1e-5  # Рекомендуемый weight decay
    mixed_precision: bool = True  # AMP для экономии VRAM
    seed: int = 42
    device: Optional[str] = None  # "cuda" | "cpu" | None => auto
    # mining/loss
    loss_type: str = "triplet"  # "triplet" | "contrastive"
    triplet_margin: float = 0.3  # Увеличено с 0.2 до 0.3 для лучшего разделения классов
    miner_type: str = "semi_hard"  # "semi_hard" | "hard" | "offline"
    # Optional: restrict negatives to similar-length sequences (ratio of anchor length)
    length_tolerance_ratio: float | None = None  # Отключено для лучшего обучения
    mining_mode: str = "online"  # "online" | "offline"
    # PK sampler controls
    pk_p: int = 8  # Уменьшено с 12 до 8 для большего количества батчей
    pk_k: int = 8  # Увеличено с 6 до 8 для batch_size=64 (P=8, K=8)
    # experiment control
    run_name: Optional[str] = None
    output_dir: str = "./outputs"  # Base output directory, will create timestamped subdirs
    resume: bool = True
    early_stopping_patience: int = 6  # Уменьшено с 8 до 6 для более быстрого переключения на hard mining
    # splits (per-user)
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    # split mode: if True, split by users (val/test users are disjoint from train users)
    split_by_users: bool = True
    # gradient clipping
    grad_clip_max_norm: float = 1.0  # Рекомендуемый gradient clipping согласно плану
    # Learning rate scheduling
    warmup_epochs: int = 3  # Number of epochs for LR warmup
    lr_reduction_factor: float = 0.7  # Уменьшено с 0.5 до 0.7 для менее агрессивного уменьшения LR
    
    # Logging
    log_frequency: int = 50  # Частота логгирования (каждые N батчей)
    
    # Legacy fields (auto-computed from output_dir + timestamp, kept for compatibility)
    checkpoint_dir: Optional[str] = None
    log_dir: Optional[str] = None
    export_dir: Optional[str] = None


@dataclass
class ExperimentConfig:
    dataset: DatasetConfig
    model: ModelConfig
    training: TrainingConfig


