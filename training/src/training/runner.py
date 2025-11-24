from dataclasses import dataclass, asdict
from typing import Optional, Tuple, Callable
import os
import random
import numpy as np
import torch
from datetime import datetime
import sys
from datetime import datetime as _dt
import json
import csv
import time

from config import DatasetConfig, ModelConfig, TrainingConfig
from data.lmdb_dataset import LmdbSignatureDataset
from data.augmentation import SignatureAugmentation, NoAugmentation
from models.hybrid import SignatureEncoder
from training.engine import train_one_epoch, evaluate
from training.miners import TripletMiner
from training.sampling import PKSampler
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR, CosineAnnealingWarmRestarts
from torch.nn import TripletMarginLoss
from torch.amp import GradScaler
from training.plots import generate_quality_plots, generate_eval_plots


def set_seed(seed: int) -> None:
    """Set random seeds for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def resolve_device(pref: Optional[str]) -> torch.device:
    """Resolve device from preference or auto-detect."""
    if pref is not None:
        return torch.device(pref)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


class SimpleLogger:
    """Simple custom logger that writes to both console and file."""

    def __init__(self, log_file_path: str):
        self.log_file_path = log_file_path

    def _format_message(self, message: str, level: str = "INFO") -> str:
        """Format log message with timestamp."""
        timestamp = _dt.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"{timestamp} - {level} - {message}"

    def info(self, message: str):
        """Log an INFO message."""
        formatted_msg = self._format_message(message, level="INFO")

        # Print to console
        print(formatted_msg)
        sys.stdout.flush()

        # Write to file - open in append mode each time
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(formatted_msg + "\n")
                f.flush()
                os.fsync(f.fileno())  # Force OS to flush to disk
        except Exception as e:
            print(f"Warning: Failed to write to log file: {e}")

    def warning(self, message: str):
        """Log a WARNING message."""
        formatted_msg = self._format_message(message, level="WARNING")

        # Print to console
        print(formatted_msg)
        sys.stdout.flush()

        # Write to file - open in append mode each time
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(formatted_msg + "\n")
                f.flush()
                os.fsync(f.fileno())  # Force OS to flush to disk
        except Exception as e:
            print(f"Warning: Failed to write to log file: {e}")

    def error(self, message: str):
        """Log an ERROR message."""
        formatted_msg = self._format_message(message, level="ERROR")

        # Print to console
        print(formatted_msg)
        sys.stdout.flush()

        # Write to file - open in append mode each time
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(formatted_msg + "\n")
                f.flush()
                os.fsync(f.fileno())  # Force OS to flush to disk
        except Exception as e:
            print(f"Warning: Failed to write to log file: {e}")


@dataclass
class TrainingRunner:
    """Training runner with business logic for checkpoints, metrics, and configs."""

    dataset_cfg: DatasetConfig
    model_cfg: ModelConfig
    train_cfg: TrainingConfig

    def _setup_output_dirs(self) -> Tuple[str, str, str, str]:
        """Setup output directories with run_name or timestamp.

        Directory structure:
        - If run_name is provided: output_dir/run_name/
        - If run_name is None: output_dir/TIMESTAMP/

        Returns:
            Tuple of (checkpoint_dir, log_dir, plot_dir, run_name)
        """
        # If legacy dirs are provided, use them as-is
        if (
            self.train_cfg.checkpoint_dir
            and self.train_cfg.log_dir
            and self.train_cfg.plot_dir
        ):
            run_name = self.train_cfg.run_name or "run"
            return (
                self.train_cfg.checkpoint_dir,
                self.train_cfg.log_dir,
                self.train_cfg.plot_dir,
                run_name,
            )

        # Determine directory name: use run_name if provided, otherwise timestamp
        if self.train_cfg.run_name:
            # Use run_name as directory name
            dir_name = self.train_cfg.run_name
            run_name = self.train_cfg.run_name
        else:
            # Use timestamp as both directory name and run_name
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dir_name = timestamp
            run_name = timestamp

        run_dir = os.path.join(self.train_cfg.output_dir, dir_name)

        checkpoint_dir = os.path.join(run_dir, "checkpoints")
        log_dir = os.path.join(run_dir, "logs")
        plot_dir = os.path.join(run_dir, "plots")

        # Create directories
        os.makedirs(checkpoint_dir, exist_ok=True)
        os.makedirs(log_dir, exist_ok=True)
        os.makedirs(plot_dir, exist_ok=True)

        return checkpoint_dir, log_dir, plot_dir, run_name

    def _setup_logging(self, log_dir: str) -> None:
        """Setup custom logger that writes to both console and file."""

        # Ensure log directory exists
        os.makedirs(log_dir, exist_ok=True)
        log_file_path = os.path.join(log_dir, "training.log")

        # Create custom logger
        self.logger = SimpleLogger(log_file_path)

        # Convenience shortcut
        self.log = self.logger.info

        # Test logging immediately
        self.log(
            "===== Session start: %s =====" % _dt.now().strftime("%Y-%m-%d %H:%M:%S")
        )

    def _create_model(self, in_features: int) -> SignatureEncoder:
        """Create SignatureEncoder model."""
        return SignatureEncoder(
            in_features=in_features,
            conv_channels=self.model_cfg.cnn_channels,
            gru_hidden=self.model_cfg.gru_hidden,
            gru_layers=self.model_cfg.gru_layers,
            emb_dim=self.model_cfg.embedding_dim,
            dropout=self.model_cfg.dropout,
        )

    def _create_optimizer(self, model: SignatureEncoder) -> AdamW:
        """Create AdamW optimizer."""
        return AdamW(
            model.parameters(),
            lr=self.train_cfg.learning_rate,
            weight_decay=self.train_cfg.weight_decay,
        )

    def _create_scheduler(self, optimizer: AdamW, steps_per_epoch: int) -> OneCycleLR:
        # More conservative max_lr for stability with triplet loss
        # Reduced from 3.0x to 2.0x base_lr to prevent gradient explosion
        max_lr = self.train_cfg.learning_rate * 2.0

        # Calculate warmup steps based on warmup_epochs
        warmup_steps = steps_per_epoch * self.train_cfg.warmup_epochs
        total_steps = steps_per_epoch * self.train_cfg.epochs
        # pct_start must be between 0 and 1
        # Clamp to [0.1, 1.0] to ensure valid range and minimum 10% warmup
        pct_start = max(min(warmup_steps / total_steps, 1.0), 0.1)

        return OneCycleLR(
            optimizer,
            max_lr=max_lr,
            epochs=self.train_cfg.epochs,
            steps_per_epoch=steps_per_epoch,
            pct_start=pct_start,  # Use calculated warmup percentage
            anneal_strategy="cos",  # Smoother annealing
        )

    def _create_miner(self) -> TripletMiner:
        """Create TripletMiner."""
        # Initial mode will be set in training loop based on miner_type
        # For now, use a default that will be overridden
        if self.train_cfg.miner_type == "batch_all":
            mode = "batch-all"
        elif self.train_cfg.miner_type == "hard":
            mode = "hard"
        else:  # None or "semi_hard" or other
            mode = "semi-hard"
        return TripletMiner(mode=mode, margin=self.train_cfg.triplet_margin)

    def _create_loss_fn(self) -> TripletMarginLoss:
        """Create TripletMarginLoss."""
        return TripletMarginLoss(margin=self.train_cfg.triplet_margin, p=2)

    def _save_checkpoint(
        self,
        model,
        optimizer,
        scheduler,
        scaler,
        epoch,
        checkpoint_dir: str,
        is_best: bool = False,
    ):
        """Save model checkpoint with persistent data splits."""
        checkpoint = {
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(),
            "scaler": scaler.state_dict() if scaler is not None else None,
            "epoch": epoch,
            "config": {
                "dataset": self.dataset_cfg.__dict__,
                "model": self.model_cfg.__dict__,
                "training": self.train_cfg.__dict__,
            },
            # <NEW> persist current train/val/test splits so that resuming run reuses them exactly
            "data_splits": getattr(self, "data_splits", None),
            # <NEW> persist runtime state for safe resume
            "state": {
                "best_eer": getattr(self, "best_eer", float("inf")),
                "stagnation_epochs": getattr(self, "stagnation_epochs", 0),
                "current_mining_phase": getattr(
                    self, "current_mining_phase", "semi-hard"
                ),
                "epochs_in_current_phase": getattr(self, "epochs_in_current_phase", 0),
                "elapsed_time": time.time()
                - getattr(self, "training_start_time", time.time()),
            },
        }

        if is_best:
            path = os.path.join(checkpoint_dir, "best_by_eer.pt")
        else:
            path = os.path.join(checkpoint_dir, "last.pt")

        torch.save(checkpoint, path)
        self.log(f"Checkpoint saved: {path}")

    def _load_checkpoint(
        self, model, optimizer, scheduler, scaler, checkpoint_dir: str
    ):
        """Load model checkpoint and return splits if available."""
        last_path = os.path.join(checkpoint_dir, "last.pt")
        if os.path.exists(last_path):
            # Use weights_only=False to allow loading custom config objects (AugmentationConfig)
            # This is safe because checkpoints are from our own training runs
            # PyTorch 2.6+ changed default to weights_only=True for security
            checkpoint = torch.load(last_path, map_location="cpu", weights_only=False)
            model.load_state_dict(checkpoint["model"])
            optimizer.load_state_dict(checkpoint["optimizer"])

            # Check scheduler compatibility before loading state
            # OneCycleLR stores step count and total_steps in state_dict
            saved_scheduler_state = checkpoint.get("scheduler", {})
            if saved_scheduler_state:
                # Check compatibility before loading
                saved_last_epoch = saved_scheduler_state.get("last_epoch", 0)
                saved_total_steps = saved_scheduler_state.get("total_steps")

                # Get current scheduler's total_steps
                current_total_steps = (
                    scheduler.total_steps if hasattr(scheduler, "total_steps") else None
                )

                # Check if we should load scheduler state
                should_load_scheduler = True
                if saved_total_steps is not None and current_total_steps is not None:
                    if saved_total_steps != current_total_steps:
                        self.log(
                            f"Warning: Scheduler total_steps mismatch (saved: {saved_total_steps}, "
                            f"current: {current_total_steps}). Not loading scheduler state to avoid step errors."
                        )
                        should_load_scheduler = False
                    elif saved_last_epoch >= saved_total_steps:
                        self.log(
                            f"Warning: Saved scheduler already completed all steps ({saved_last_epoch}/{saved_total_steps}). "
                            f"Not loading scheduler state."
                        )
                        should_load_scheduler = False

                if should_load_scheduler:
                    try:
                        scheduler.load_state_dict(saved_scheduler_state)
                    except Exception as e:
                        self.log(
                            f"Warning: Failed to load scheduler state: {e}. "
                            f"Continuing with new scheduler state."
                        )
            else:
                self.log(
                    "Warning: No scheduler state found in checkpoint. Using new scheduler."
                )

            if scaler is not None and "scaler" in checkpoint:
                scaler.load_state_dict(checkpoint["scaler"])
            start_epoch = checkpoint["epoch"] + 1

            # <NEW>
            data_splits = checkpoint.get("data_splits")
            state = checkpoint.get("state", {})
            best_eer = state.get("best_eer", float("inf"))
            stagnation_epochs = state.get("stagnation_epochs", 0)
            current_mining_phase = state.get("current_mining_phase", "semi-hard")
            epochs_in_current_phase = state.get("epochs_in_current_phase", 0)
            elapsed_time = state.get("elapsed_time", 0.0)
            # store on self for later use
            self._resume_state = {
                "best_eer": best_eer,
                "stagnation_epochs": stagnation_epochs,
                "current_mining_phase": current_mining_phase,
                "epochs_in_current_phase": epochs_in_current_phase,
                "elapsed_time": elapsed_time,
            }

            self.log(f"Resumed from checkpoint: {last_path}, epoch {start_epoch}")
            return start_epoch, data_splits
        return 0, None

    def _load_saved_splits(self, checkpoint_dir: str):
        """Load only data_splits dict from checkpoint if present."""
        last_path = os.path.join(checkpoint_dir, "last.pt")
        if os.path.exists(last_path):
            try:
                # Use weights_only=False to allow loading custom config objects (AugmentationConfig)
                # This is safe because checkpoints are from our own training runs
                # PyTorch 2.6+ changed default to weights_only=True for security
                chk = torch.load(last_path, map_location="cpu", weights_only=False)
                return chk.get("data_splits")
            except Exception:
                return None
        return None

    def _setup_metrics_logging(self, log_dir: str) -> str:
        """Setup CSV file for epoch metrics logging."""
        metrics_file = os.path.join(log_dir, "epoch_metrics.csv")

        # Create CSV header if file doesn't exist
        if not os.path.exists(metrics_file):
            with open(metrics_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(
                    [
                        "epoch",
                        "train_loss",
                        "train_grad_norm",
                        "train_triplets",
                        "train_time",
                        "val_eer",
                        "val_auc",
                        "val_time",
                        "learning_rate",
                        "miner_mode",
                        "best_eer",
                        "stagnation_epochs",
                        "total_time",
                    ]
                )

        self.log(f"Metrics will be logged to: {metrics_file}")
        return metrics_file

    def _log_epoch_metrics(
        self,
        metrics_file: str,
        epoch: int,
        train_metrics: dict,
        val_metrics: dict,
        learning_rate: float,
        miner_mode: str,
        best_eer: float,
        stagnation_epochs: int,
        total_time: float,
    ):
        """Log epoch metrics to CSV file."""
        with open(metrics_file, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    epoch + 1,
                    train_metrics.get("avg_loss", 0.0),
                    train_metrics.get("avg_grad_norm", 0.0),
                    train_metrics.get("avg_triplets", 0.0),
                    train_metrics.get("total_time", 0.0),
                    val_metrics.get("eer", 0.0),
                    val_metrics.get("auc", 0.0),
                    val_metrics.get("eval_time", 0.0),
                    learning_rate,
                    miner_mode,
                    best_eer,
                    stagnation_epochs,
                    total_time,
                ]
            )

    def _log_test_metrics(
        self, metrics_file: str, test_metrics: dict, total_time: float
    ):
        """Log final test metrics to CSV file."""
        with open(metrics_file, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "FINAL_TEST",
                    0.0,  # train_loss
                    0.0,  # train_grad_norm
                    0.0,  # train_triplets
                    0.0,  # train_time
                    test_metrics.get("eer", 0.0),
                    test_metrics.get("auc", 0.0),
                    test_metrics.get("eval_time", 0.0),
                    0.0,  # learning_rate
                    "test",  # miner_mode
                    test_metrics.get("eer", 0.0),  # best_eer
                    0,  # stagnation_epochs
                    total_time,
                ]
            )

    def _create_data_splits(self, dataset: LmdbSignatureDataset):
        """Create train/val/test splits using pre-built ``self._user_index``."""

        user_codes = list(self._user_index.keys())  # type: ignore[attr-defined]
        random.shuffle(user_codes)

        total_users = len(user_codes)
        train_users = int(total_users * self.train_cfg.train_ratio)
        val_users = int(total_users * self.train_cfg.val_ratio)

        train_user_codes = user_codes[:train_users]
        val_user_codes = user_codes[train_users : train_users + val_users]
        test_user_codes = user_codes[train_users + val_users :]

        self.log(
            f"Data splits: Train={len(train_user_codes)} users, "
            f"Val={len(val_user_codes)} users, Test={len(test_user_codes)} users"
        )

        return train_user_codes, val_user_codes, test_user_codes

    def _create_dataset_sample(
        self, dataset: LmdbSignatureDataset
    ) -> LmdbSignatureDataset:
        """Create a sample of dataset for quick testing."""
        if self.dataset_cfg.dataset_sample_ratio is None:
            return dataset

        sample_ratio = self.dataset_cfg.dataset_sample_ratio
        total_samples = len(dataset)
        sample_size = int(total_samples * sample_ratio)

        self.log(
            f"Creating dataset sample: {sample_size}/{total_samples} samples ({sample_ratio*100:.1f}%)"
        )

        # Randomly select indices
        import random

        random.seed(self.train_cfg.seed)
        sample_indices = random.sample(range(total_samples), sample_size)
        sample_indices.sort()  # Keep original order for reproducibility

        # Create wrapper for sampled dataset
        class DatasetSampleWrapper:
            def __init__(self, dataset, sample_indices):
                self.dataset = dataset
                self.sample_indices = sample_indices

            def __len__(self):
                return len(self.sample_indices)

            def __getitem__(self, idx):
                original_idx = self.sample_indices[idx]
                return self.dataset[original_idx]

            def get_user_code(self, idx):
                """Get user_code for wrapped index (maps to original dataset index)."""
                original_idx = self.sample_indices[idx]
                return self.dataset.get_user_code(original_idx)

            def collate_fn(self, batch):
                return self.dataset.collate_fn(batch)

        wrapper = DatasetSampleWrapper(dataset, sample_indices)
        wrapper.collate_fn = wrapper.collate_fn
        return wrapper

    def _create_split_dataset(
        self,
        dataset: LmdbSignatureDataset,
        user_codes: set,
        return_user_code: bool = False,
        transform: Optional[Callable] = None,
    ):
        """Create subset using pre-built *user index* for speed."""

        if hasattr(self, "_user_index"):
            indices = [idx for uc in user_codes for idx in self._user_index.get(uc, [])]  # type: ignore[attr-defined]
            self.log(
                f"Subset for {len(user_codes)} users contains {len(indices)} samples (fast path)."
            )
        else:
            # Fallback to slow scan (should not happen in normal flow)
            self.log("Warning: _user_index missing, falling back to slow path.")
            indices = [
                i for i in range(len(dataset)) if dataset.get_user_code(i) in user_codes
            ]

        return self._create_subset_wrapper(
            dataset,
            indices,
            return_user_code=return_user_code,
            transform=transform,
        )

    # ---------------------------------------------------------------------
    # Fast utilities for building user_code → indices mapping
    # ---------------------------------------------------------------------

    def _build_user_index(self, dataset: LmdbSignatureDataset):
        """Create mapping user_code → list[int] and flat list of (index, user_code).

        Uses the lightweight ``dataset.get_user_code`` method – no CSV decoding –
        so the whole pass over 16k samples takes only a few seconds.
        """
        from collections import defaultdict

        user_to_indices: dict[str, list[int]] = defaultdict(list)
        total_samples = len(dataset)

        self.log("Building user index (fast path)...")
        for i in range(total_samples):
            code = dataset.get_user_code(i)
            user_to_indices[code].append(i)
            if (i + 1) % 1000 == 0 or (i + 1) == total_samples:
                pct = (i + 1) / total_samples * 100
                self.log(f"Index progress: {i+1}/{total_samples} ({pct:.1f}%)")

        self.log(f"Built user index for {len(user_to_indices)} users")
        return user_to_indices

    def _create_subset_wrapper(
        self,
        dataset: LmdbSignatureDataset,
        indices: list[int],
        return_user_code: bool = False,
        transform: Optional[Callable] = None,
    ):
        """Lightweight wrapper that exposes only selected indices."""

        class _Subset:
            def __init__(self, ds, idxs, return_uc, tfm):
                self.dataset = ds
                self.indices = idxs
                self.return_uc = return_uc
                self.transform = tfm

            def __len__(self):
                return len(self.indices)

            def __getitem__(self, idx):
                original_idx = self.indices[idx]
                tensor, mask, user_id, user_code = self.dataset[original_idx]
                if self.transform is not None:
                    tensor = self.transform(tensor)
                if self.return_uc:
                    return tensor, mask, user_id, user_code
                return tensor, mask, user_id

            def collate_fn(self, batch):
                return self.dataset.collate_fn(batch)

        wrapper = _Subset(dataset, indices, return_user_code, transform)
        wrapper.collate_fn = wrapper.collate_fn
        return wrapper

    def run(self) -> None:
        """Main training run method."""
        print("Starting training run...")
        set_seed(self.train_cfg.seed)
        device = resolve_device(self.train_cfg.device)

        # Setup output directories
        checkpoint_dir, log_dir, plot_dir, run_name = self._setup_output_dirs()

        # Setup logging
        self._setup_logging(log_dir)

        # Setup metrics logging
        metrics_file = self._setup_metrics_logging(log_dir)

        self.log(f"Starting training run: {run_name}")
        self.log(f"Device: {device}")
        self.log(f"Checkpoint dir: {checkpoint_dir}")
        self.log(f"Log dir: {log_dir}")
        self.log(f"Plot dir: {plot_dir}")

        # Force flush to ensure output is visible
        sys.stdout.flush()

        # Dump full configuration
        self.log("=" * 80)
        self.log("FULL CONFIGURATION DUMP")
        self.log("=" * 80)

        self.log("DatasetConfig:")
        for key, value in self.dataset_cfg.__dict__.items():
            self.log(f"  {key}: {value}")

        self.log("ModelConfig:")
        for key, value in self.model_cfg.__dict__.items():
            self.log(f"  {key}: {value}")

        self.log("TrainingConfig:")
        for key, value in self.train_cfg.__dict__.items():
            self.log(f"  {key}: {value}")

        self.log("=" * 80)

        # Force flush to ensure output is visible
        sys.stdout.flush()

        # Save configs to JSON file
        # Use asdict() to recursively convert dataclass objects (including nested ones like AugmentationConfig)
        configs_data = {
            "dataset_config": asdict(self.dataset_cfg),
            "model_config": asdict(self.model_cfg),
            "training_config": asdict(self.train_cfg),
        }
        configs_file_path = os.path.join(log_dir, "configs.json")
        with open(configs_file_path, "w", encoding="utf-8") as f:
            json.dump(configs_data, f, indent=2, ensure_ascii=False)
        self.log(f"Configs saved to: {configs_file_path}")

        try:
            # Calculate input features: base features (x,y,p,t_norm) + derived features
            # Calculate input features: unique features from feature_pipeline
            # feature_pipeline может содержать как базовые (x, y, p, t), так и производные признаки
            in_features = len(self.dataset_cfg.feature_pipeline)

            self.log(
                f"Input features: {in_features} from feature_pipeline: {self.dataset_cfg.feature_pipeline}"
            )

            # Create model
            self.log("Creating model...")
            model = self._create_model(in_features).to(device)
            self.log(
                f"Model created: {sum(p.numel() for p in model.parameters())} parameters"
            )

            # Create full dataset
            self.log("Loading dataset...")
            full_dataset = LmdbSignatureDataset(
                lmdb_path=self.dataset_cfg.lmdb_path,
                max_sequence_length=self.dataset_cfg.max_sequence_length,
                feature_pipeline=self.dataset_cfg.feature_pipeline,
                return_user_code=True,
            )
            self.log(f"Full dataset loaded: {len(full_dataset)} samples")

            # ------------------------------------------------------------------
            # Build fast user index once (avoids multiple scans + heavy __getitem__)
            # ------------------------------------------------------------------
            self._user_index = self._build_user_index(full_dataset)

            # Create dataset sample if specified
            full_dataset = self._create_dataset_sample(full_dataset)
            self.log(f"Using dataset: {len(full_dataset)} samples")

            # Create data splits
            self.log("Creating data splits...")

            # <NEW> Load splits from checkpoint if resuming (before creating optimizer/scheduler)
            saved_splits = None
            if self.train_cfg.resume:
                saved_splits = self._load_saved_splits(checkpoint_dir)

            if saved_splits:
                self.log("Using data splits loaded from checkpoint (resume mode)")
                train_user_codes = saved_splits["train_user_codes"]
                val_user_codes = saved_splits["val_user_codes"]
                test_user_codes = saved_splits["test_user_codes"]
            else:
                train_user_codes, val_user_codes, test_user_codes = (
                    self._create_data_splits(full_dataset)
                )

            # Persist splits on self so that _save_checkpoint can include them
            self.data_splits = {
                "train_user_codes": train_user_codes,
                "val_user_codes": val_user_codes,
                "test_user_codes": test_user_codes,
            }

            # Create split datasets with augmentation for training
            self.log("Creating split datasets...")

            # Apply augmentation only to training set
            train_transform = (
                SignatureAugmentation(
                    feature_pipeline=self.dataset_cfg.feature_pipeline,
                    config=self.dataset_cfg.augmentation,
                )
                if self.dataset_cfg.augment
                else NoAugmentation()
            )

            train_dataset = self._create_split_dataset(
                full_dataset,
                set(train_user_codes),
                return_user_code=True,
                transform=train_transform,
            )
            val_dataset = self._create_split_dataset(
                full_dataset,
                set(val_user_codes),
                transform=NoAugmentation(),  # No augmentation for validation
            )
            test_dataset = self._create_split_dataset(
                full_dataset,
                set(test_user_codes),
                transform=NoAugmentation(),  # No augmentation for test
            )

            self.log(
                f"Dataset sizes: Train={len(train_dataset)}, Val={len(val_dataset)}, Test={len(test_dataset)}"
            )

            # Create PK sampler for balanced batches
            self.log("Creating PK sampler...")
            # Get user_codes for train dataset
            train_indices = train_dataset.indices  # type: ignore[attr-defined]
            # train_indices are indices in train_dataset, which wraps full_dataset
            # Use train_dataset.dataset to access the underlying dataset
            underlying_dataset = train_dataset.dataset  # type: ignore[attr-defined]
            train_user_codes = [
                underlying_dataset.get_user_code(i) for i in train_indices
            ]
            self.log(
                f"Extracted user codes for PK sampling using fast path: {len(train_user_codes)} entries"
            )

            pk_sampler = PKSampler(
                labels=train_user_codes,
                P=self.train_cfg.pk_p,
                K=self.train_cfg.pk_k,
                shuffle_identities=True,
                epoch_multiplier=self.train_cfg.pk_epoch_multiplier,
                use_all_data=self.train_cfg.pk_use_all_data,
            )

            # Calculate data usage statistics
            unique_users = len(set(train_user_codes))
            batches_per_epoch = len(pk_sampler)
            samples_per_epoch = (
                batches_per_epoch * self.train_cfg.pk_p * self.train_cfg.pk_k
            )

            # When use_all_data=True, we systematically cycle through all samples
            if self.train_cfg.pk_use_all_data:
                # With use_all_data, all samples will be used at least once per epoch
                # The actual usage depends on how many times each identity appears
                train_dataset_size = len(train_dataset)
                # Each identity appears epoch_multiplier times
                # Each appearance uses K samples, cycling through all samples
                # So coverage = min(100%, (epoch_multiplier * K / samples_per_user) * 100)
                data_usage_pct = 100.0  # With use_all_data, we guarantee 100% coverage
                data_usage_note = " (100% coverage guaranteed with use_all_data=True)"
            else:
                data_usage_pct = (samples_per_epoch / train_dataset_size) * 100
                data_usage_note = ""

            self.log(
                f"PK sampler created: P={self.train_cfg.pk_p}, K={self.train_cfg.pk_k}, "
                f"epoch_multiplier={self.train_cfg.pk_epoch_multiplier}, "
                f"use_all_data={self.train_cfg.pk_use_all_data}"
            )
            self.log(
                f"Sampling stats: {unique_users} unique users, {batches_per_epoch} batches/epoch, "
                f"{samples_per_epoch} samples/epoch ({data_usage_pct:.1f}% of {train_dataset_size} total{data_usage_note})"
            )

            train_loader = DataLoader(
                train_dataset,
                batch_sampler=pk_sampler,
                num_workers=self.dataset_cfg.num_workers,
                pin_memory=True,
                collate_fn=train_dataset.collate_fn,
            )

            # Create validation and test loaders
            self.log("Creating validation and test loaders...")
            val_loader = DataLoader(
                val_dataset,
                batch_size=self.dataset_cfg.batch_size,
                num_workers=self.dataset_cfg.num_workers,
                pin_memory=True,
                collate_fn=val_dataset.collate_fn,
                shuffle=False,
            )

            test_loader = DataLoader(
                test_dataset,
                batch_size=self.dataset_cfg.batch_size,
                num_workers=self.dataset_cfg.num_workers,
                pin_memory=True,
                collate_fn=test_dataset.collate_fn,
                shuffle=False,
            )

            # Create optimizer, scheduler, miner, loss
            self.log("Creating optimizer, scheduler, miner, loss...")
            optimizer = self._create_optimizer(model)
            # Adjust steps_per_epoch for gradient accumulation
            # scheduler.step() is called only after each accumulated batch,
            # so we need to divide by grad_accum_steps
            effective_steps_per_epoch = (
                len(train_loader) // self.train_cfg.grad_accum_steps
            )
            scheduler = self._create_scheduler(optimizer, effective_steps_per_epoch)
            miner = self._create_miner()
            loss_fn = self._create_loss_fn()
            scaler = GradScaler("cuda") if self.train_cfg.mixed_precision else None

            self.log(f"Training setup complete:")
            self.log(f"  - Batches per epoch: {len(train_loader)}")
            self.log(
                f"  - Effective scheduler steps per epoch: {effective_steps_per_epoch} (with grad_accum_steps={self.train_cfg.grad_accum_steps})"
            )
            self.log(f"  - Learning rate: {self.train_cfg.learning_rate}")
            self.log(f"  - Miner mode: {miner.mode}")
            self.log(f"  - Triplet margin: {self.train_cfg.triplet_margin}")

            # Load checkpoint if resuming (after creating optimizer/scheduler/scaler)
            start_epoch = 0
            if self.train_cfg.resume:
                start_epoch, _ = self._load_checkpoint(
                    model, optimizer, scheduler, scaler, checkpoint_dir
                )
                # Note: data_splits already loaded earlier via _load_saved_splits

            # Training loop
            if hasattr(self, "_resume_state"):
                best_eer = self._resume_state["best_eer"]
                stagnation_epochs = self._resume_state["stagnation_epochs"]
                current_mining_phase = self._resume_state["current_mining_phase"]
                epochs_in_current_phase = self._resume_state["epochs_in_current_phase"]
                elapsed_prev = self._resume_state["elapsed_time"]
            else:
                best_eer = float("inf")
                stagnation_epochs = 0
                current_mining_phase = miner.mode  # default from earlier setup
                epochs_in_current_phase = 0
                elapsed_prev = 0.0

            self.training_start_time: float = (
                time.time()
            )  # initialize, will adjust if resume

            # Initialize adaptive mining phase tracking based on miner_type
            # miner_type = None: semi-hard → hard → batch-all
            # miner_type = "hard": hard → batch-all
            # miner_type = "batch_all": batch-all only (no switching)
            if self.train_cfg.miner_type is None:
                # Adaptive: start with semi-hard, progress through all phases
                current_mining_phase = "semi-hard"
                mining_phase_progression = {
                    "semi-hard": "hard",
                    "hard": "batch-all",
                    "batch-all": None,  # Final phase, no more switches
                }
            elif self.train_cfg.miner_type == "hard":
                # Start with hard, then progress to batch-all
                current_mining_phase = "hard"
                mining_phase_progression = {
                    "hard": "batch-all",
                    "batch-all": None,  # Final phase, no more switches
                }
            elif self.train_cfg.miner_type == "batch_all":
                # Start and stay with batch-all, no switching
                current_mining_phase = "batch-all"
                mining_phase_progression = {
                    "batch-all": None,  # No progression, stay in batch-all
                }
            else:
                # Fallback: treat as semi-hard (for backward compatibility)
                current_mining_phase = "semi-hard"
                mining_phase_progression = {
                    "semi-hard": "hard",
                    "hard": "batch-all",
                    "batch-all": None,
                }

            epochs_in_current_phase = 0

            # Set initial miner mode
            miner.set_mode(current_mining_phase)
            self.log(
                f"Initial mining strategy: {current_mining_phase} "
                f"(miner_type={self.train_cfg.miner_type})"
            )

            for epoch in range(start_epoch, self.train_cfg.epochs):
                epoch_start_time = time.time()
                self.log(f"=== Epoch {epoch+1}/{self.train_cfg.epochs} ===")

                # Adaptive triplet mining strategy based on stagnation
                # Phase progression depends on miner_type:
                #   - None: semi-hard → hard → batch-all
                #   - "hard": hard → batch-all
                #   - "batch_all": no switching (stays in batch-all)
                # Switch happens when stagnation_epochs >= threshold AND minimum epochs passed
                target_mode = current_mining_phase
                should_switch = False
                next_phase = mining_phase_progression.get(current_mining_phase)

                if next_phase is not None:  # Not in final phase
                    stagnation_threshold = (
                        self.train_cfg.mining_switch_stagnation_threshold
                    )
                    min_epochs = self.train_cfg.min_epochs_per_mining_phase

                    if (
                        stagnation_epochs >= stagnation_threshold
                        and epochs_in_current_phase >= min_epochs
                    ):
                        should_switch = True
                        target_mode = next_phase

                # Update miner mode if needed
                miner_mode_changed = False
                if should_switch:
                    miner.set_mode(target_mode)
                    miner_mode_changed = True
                    previous_phase = current_mining_phase
                    epochs_spent_in_previous_phase = epochs_in_current_phase
                    current_mining_phase = target_mode
                    epochs_in_current_phase = 0  # Reset counter for new phase

                    self.log(
                        f"Miner mode switched to: {target_mode} "
                        f"(after {stagnation_epochs} stagnation epochs in {previous_phase} phase, "
                        f"spent {epochs_spent_in_previous_phase} epochs total in {previous_phase})"
                    )

                    # Reset stagnation counter when miner mode changes
                    if stagnation_epochs > 0:
                        self.log(
                            f"Resetting stagnation counter (was {stagnation_epochs}) due to miner mode change"
                        )
                        stagnation_epochs = 0
                elif epoch == start_epoch:
                    # First epoch: ensure miner matches current_mining_phase
                    if miner.mode != current_mining_phase:
                        miner.set_mode(current_mining_phase)
                        self.log(f"Initialized miner to {current_mining_phase} mode")

                epochs_in_current_phase += 1

                # Train one epoch
                train_metrics = train_one_epoch(
                    model,
                    train_loader,
                    optimizer,
                    scheduler,
                    miner,
                    loss_fn,
                    device,
                    scaler,
                    grad_accum_steps=self.train_cfg.grad_accum_steps,
                    grad_clip_max_norm=self.train_cfg.grad_clip_max_norm,
                    logger=self.logger,
                    log_frequency=self.train_cfg.log_frequency,
                )

                # Log warning if loss increased significantly after miner mode change
                if miner_mode_changed and epoch > 0:
                    prev_loss = getattr(self, "_prev_loss", None)
                    if prev_loss is not None:
                        loss_increase = (
                            (train_metrics["avg_loss"] - prev_loss) / prev_loss * 100
                        )
                        if loss_increase > 20:  # More than 20% increase
                            self.log(
                                f"WARNING: Loss increased by {loss_increase:.1f}% after switching to {target_mode} mining. "
                                f"This is expected and normal - hard mining focuses on difficult triplets."
                            )
                self._prev_loss = train_metrics["avg_loss"]

                # Validation on separate validation set
                self.log("Starting validation...")
                val_start_time = time.time()
                try:
                    val_eer, val_auc, val_emb, val_labels = evaluate(
                        model, val_loader, device, self.logger
                    )
                    val_metrics = {
                        "eer": val_eer,
                        "auc": val_auc,
                        "eval_time": time.time() - val_start_time,
                    }
                    self.log(f"Validation - EER: {val_eer:.4f}, AUC: {val_auc:.4f}")
                except Exception as e:
                    self.log(f"Validation failed: {e}")
                    val_metrics = {"eer": 1.0, "auc": 0.5, "eval_time": 0.0}

                # Save state to self before checkpoint save
                self.best_eer = best_eer
                self.stagnation_epochs = stagnation_epochs
                self.current_mining_phase = current_mining_phase
                self.epochs_in_current_phase = epochs_in_current_phase

                # Save checkpoint
                self._save_checkpoint(
                    model, optimizer, scheduler, scaler, epoch, checkpoint_dir
                )

                # keep miner batch-all semi-hard throughout; no switch

                # Early stopping check based on validation EER
                if val_metrics["eer"] < best_eer:
                    best_eer = val_metrics["eer"]
                    stagnation_epochs = 0
                    # Update state before saving best checkpoint
                    self.best_eer = best_eer
                    self.stagnation_epochs = stagnation_epochs
                    self._save_checkpoint(
                        model,
                        optimizer,
                        scheduler,
                        scaler,
                        epoch,
                        checkpoint_dir,
                        is_best=True,
                    )
                    self.log(f"New best EER: {best_eer:.4f}")
                    # Generate evaluation plots on improvement
                    generate_eval_plots(
                        val_emb, val_labels, plot_dir, tag=f"val_epoch_{epoch+1}"
                    )
                else:
                    stagnation_epochs += 1

                # Check for early stopping
                if stagnation_epochs >= self.train_cfg.early_stopping_patience:
                    self.log(
                        f"Early stopping after {epoch+1} epochs (no improvement for {stagnation_epochs} epochs)"
                    )
                    break

                # Log epoch metrics to CSV
                epoch_time = time.time() - epoch_start_time
                total_time = time.time() - self.training_start_time
                current_lr = optimizer.param_groups[0]["lr"]

                self._log_epoch_metrics(
                    metrics_file=metrics_file,
                    epoch=epoch,
                    train_metrics=train_metrics,
                    val_metrics=val_metrics,
                    learning_rate=current_lr,
                    miner_mode=miner.mode,
                    best_eer=best_eer,
                    stagnation_epochs=stagnation_epochs,
                    total_time=total_time,
                )

                # Log epoch summary
                self.log(f"Epoch {epoch+1} Summary:")
                self.log(f"  Train Loss: {train_metrics['avg_loss']:.4f}")
                self.log(
                    f"  Val EER: {val_metrics['eer']:.4f}, Val AUC: {val_metrics['auc']:.4f}"
                )
                self.log(f"  Best EER: {best_eer:.4f}")
                self.log(
                    f"  LR: {current_lr:.6f}, Miner: {miner.mode} "
                    f"(phase: {current_mining_phase}, epochs in phase: {epochs_in_current_phase}, "
                    f"stagnation: {stagnation_epochs}/{self.train_cfg.mining_switch_stagnation_threshold})"
                )
                self.log(f"  Epoch Time: {epoch_time:.2f}s")

            # Final test evaluation
            self.log("=" * 80)
            self.log("FINAL TEST EVALUATION")
            self.log("=" * 80)

            test_start_time = time.time()
            try:
                test_eer, test_auc, test_emb, test_labels = evaluate(
                    model, test_loader, device, self.logger
                )
                test_metrics = {
                    "eer": test_eer,
                    "auc": test_auc,
                    "eval_time": time.time() - test_start_time,
                }
                self.log(f"FINAL TEST RESULTS:")
                self.log(f"  Test EER: {test_eer:.4f}")
                self.log(f"  Test AUC: {test_auc:.4f}")
                self.log(f"  Evaluation Time: {test_metrics['eval_time']:.2f}s")
                # plots
                generate_eval_plots(test_emb, test_labels, plot_dir, tag="test")

                # Log test metrics to CSV
                total_time = time.time() - self.training_start_time
                self._log_test_metrics(metrics_file, test_metrics, total_time)
                # Generate final plots
                generate_quality_plots(metrics_file, plot_dir, stage="test")

            except Exception as e:
                self.log(f"Final test evaluation failed: {e}")
                test_metrics = {"eer": 1.0, "auc": 0.5, "eval_time": 0.0}

            self.log("=" * 80)
            self.log("Training completed successfully!")
            self.log("=" * 80)

        except Exception as e:
            self.log(f"Training failed: {e}")
            raise e
