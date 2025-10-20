from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class DatasetConfig:
    lmdb_path: str
    num_workers: int = 0
    batch_size: int = 32  # {УМЕНЬШЕНО: с 64 до 32}/{как в успешной delta_reworked модели}/{лучшая стабильность обучения}
    augment: bool = True
    max_sequence_length: int = 5500
    feature_pipeline: List[str] = field(default_factory=lambda: [
        # configurable list of derivative feature names, e.g. ["vx","vy","ax","ay","jerk","curvature","dt","dp","dp_dt"]
    ])


@dataclass
class ModelConfig:
    name: str = "hybrid"
    embedding_dim: int = 256
    # Optional model-specific parameters (passed as **kwargs to model constructor)
    cnn_channels: Optional[int] = None
    lstm_hidden: Optional[int] = None
    lstm_layers: Optional[int] = None
    attn_heads: Optional[int] = None
    dropout: Optional[float] = 0.25  # {было: 0.4}/{слишком агрессивный dropout вызывал NaN}/{стабильное обучение без коллапса градиентов}


@dataclass
class TrainingConfig:
    epochs: int = 10
    learning_rate: float = 2e-4  # {УВЕЛИЧЕНО: с 1e-4 до 2e-4}/{слишком низкий LR для валидации}/{более агрессивное обучение}
    weight_decay: float = 1e-5
    mixed_precision: bool = True
    seed: int = 42
    device: Optional[str] = None  # "cuda" | "cpu" | None => auto
    # mining/loss
    loss_type: str = "triplet"  # "triplet" | "contrastive"
    triplet_margin: float = 0.25  # {УВЕЛИЧЕНО: с 0.1 до 0.25}/{как в успешной delta_reworked модели}/{больший margin для лучшего разделения классов}
    miner_type: str = "semi_hard"  # "semi_hard" | "hard" | "offline"
    # Optional: restrict negatives to similar-length sequences (ratio of anchor length)
    length_tolerance_ratio: float | None = 0.2
    mining_mode: str = "online"  # "online" | "offline"
    # PK sampler controls
    pk_k: int = 4
    # experiment control
    run_name: Optional[str] = None
    output_dir: str = "./outputs"  # Base output directory, will create timestamped subdirs
    resume: bool = True
    early_stopping_patience: int = 5
    # splits (per-user)
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    # split mode: if True, split by users (val/test users are disjoint from train users)
    split_by_users: bool = True
    # gradient clipping
    grad_clip_max_norm: float = 1.0  # {было: 0.5}/{слишком агрессивный clipping убивал градиенты}/{градиенты смогут обновлять веса эффективно}
    # warmup
    warmup_epochs: int = 3  # Number of epochs for LR warmup
    
    # Legacy fields (auto-computed from output_dir + timestamp, kept for compatibility)
    checkpoint_dir: Optional[str] = None
    log_dir: Optional[str] = None
    export_dir: Optional[str] = None


@dataclass
class ExperimentConfig:
    dataset: DatasetConfig
    model: ModelConfig
    training: TrainingConfig


