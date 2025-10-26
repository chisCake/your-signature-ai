from dataclasses import dataclass
from typing import Optional, Tuple
import os
import random
import numpy as np
import torch
from datetime import datetime
import sys
from datetime import datetime as _dt
import logging
import json
import csv
import time

from config import DatasetConfig, ModelConfig, TrainingConfig
from data.lmdb_dataset import LmdbSignatureDataset
from models.hybrid import SignatureEncoder
from training.engine import train_one_epoch, evaluate
from training.miners import TripletMiner
from training.sampling import PKSampler
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR, CosineAnnealingWarmRestarts
from torch.nn import TripletMarginLoss
from torch.amp import GradScaler


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
            Tuple of (checkpoint_dir, log_dir, export_dir, run_name)
        """
        # If legacy dirs are provided, use them as-is
        if (
            self.train_cfg.checkpoint_dir
            and self.train_cfg.log_dir
            and self.train_cfg.export_dir
        ):
            run_name = self.train_cfg.run_name or "run"
            return (
                self.train_cfg.checkpoint_dir,
                self.train_cfg.log_dir,
                self.train_cfg.export_dir,
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
        export_dir = os.path.join(run_dir, "exports")

        # Create directories
        os.makedirs(checkpoint_dir, exist_ok=True)
        os.makedirs(log_dir, exist_ok=True)
        os.makedirs(export_dir, exist_ok=True)

        return checkpoint_dir, log_dir, export_dir, run_name

    def _setup_logging(self, log_dir: str) -> None:
        """Setup logging to both console and file."""
        log_file_path = os.path.join(log_dir, "training.log")
        
        # Configure root logger for file only
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file_path, mode='a', encoding='utf-8'),
            ]
        )
        
        # Get logger instance
        self.logger = logging.getLogger(__name__)
        
        # Create simple logging function for Colab compatibility
        def simple_log(message):
            # Only print to console for Colab visibility
            print(f"[{_dt.now().strftime('%H:%M:%S')}] {message}")
            sys.stdout.flush()
        
        # Create file logging function for important messages
        def log_to_file(message):
            self.logger.info(message)
        
        self.log = simple_log
        self.log_file = log_to_file
        self.logger.info(f"===== Session start: {_dt.now().strftime('%Y-%m-%d %H:%M:%S')} =====")

    def _create_model(self, in_features: int) -> SignatureEncoder:
        """Create SignatureEncoder model."""
        return SignatureEncoder(
            in_features=in_features,
            conv_channels=self.model_cfg.cnn_channels or (64, 128),
            gru_hidden=self.model_cfg.gru_hidden,
            gru_layers=self.model_cfg.gru_layers,
            emb_dim=self.model_cfg.embedding_dim,
            dropout=self.model_cfg.dropout
        )

    def _create_optimizer(self, model: SignatureEncoder) -> AdamW:
        """Create AdamW optimizer."""
        return AdamW(
            model.parameters(),
            lr=self.train_cfg.learning_rate,
            weight_decay=self.train_cfg.weight_decay
        )

    def _create_scheduler(self, optimizer: AdamW, steps_per_epoch: int) -> OneCycleLR:
        """Create OneCycleLR scheduler."""
        return OneCycleLR(
            optimizer,
            max_lr=self.train_cfg.learning_rate,
            epochs=self.train_cfg.epochs,
            steps_per_epoch=steps_per_epoch
        )

    def _create_miner(self) -> TripletMiner:
        """Create TripletMiner."""
        mode = "semi-hard" if self.train_cfg.miner_type == "semi_hard" else "hard"
        return TripletMiner(mode=mode, margin=self.train_cfg.triplet_margin)

    def _create_loss_fn(self) -> TripletMarginLoss:
        """Create TripletMarginLoss."""
        return TripletMarginLoss(margin=self.train_cfg.triplet_margin, p=2)

    def _save_checkpoint(self, model, optimizer, scheduler, scaler, epoch, 
                        checkpoint_dir: str, is_best: bool = False):
        """Save model checkpoint."""
        checkpoint = {
            'model': model.state_dict(),
            'optimizer': optimizer.state_dict(),
            'scheduler': scheduler.state_dict(),
            'scaler': scaler.state_dict(),
            'epoch': epoch,
            'config': {
                'dataset': self.dataset_cfg.__dict__,
                'model': self.model_cfg.__dict__,
                'training': self.train_cfg.__dict__
            }
        }
        
        if is_best:
            path = os.path.join(checkpoint_dir, "best_by_eer.pt")
        else:
            path = os.path.join(checkpoint_dir, "last.pt")
        
        torch.save(checkpoint, path)
        self.log(f"Checkpoint saved: {path}")

    def _load_checkpoint(self, model, optimizer, scheduler, scaler, checkpoint_dir: str):
        """Load model checkpoint."""
        last_path = os.path.join(checkpoint_dir, "last.pt")
        if os.path.exists(last_path):
            checkpoint = torch.load(last_path, map_location='cpu')
            model.load_state_dict(checkpoint['model'])
            optimizer.load_state_dict(checkpoint['optimizer'])
            scheduler.load_state_dict(checkpoint['scheduler'])
            scaler.load_state_dict(checkpoint['scaler'])
            start_epoch = checkpoint['epoch'] + 1
            self.log(f"Resumed from checkpoint: {last_path}, epoch {start_epoch}")
            return start_epoch
        return 0

    def _setup_metrics_logging(self, log_dir: str) -> str:
        """Setup CSV file for epoch metrics logging."""
        metrics_file = os.path.join(log_dir, "epoch_metrics.csv")
        
        # Create CSV header if file doesn't exist
        if not os.path.exists(metrics_file):
            with open(metrics_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'epoch', 'train_loss', 'train_grad_norm', 'train_triplets', 'train_time',
                    'val_eer', 'val_auc', 'val_time', 'learning_rate', 'miner_mode',
                    'best_eer', 'stagnation_epochs', 'total_time'
                ])
        
        self.log(f"Metrics will be logged to: {metrics_file}")
        return metrics_file

    def _log_epoch_metrics(self, metrics_file: str, epoch: int, train_metrics: dict, 
                          val_metrics: dict, learning_rate: float, miner_mode: str,
                          best_eer: float, stagnation_epochs: int, total_time: float):
        """Log epoch metrics to CSV file."""
        with open(metrics_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                epoch + 1,
                train_metrics.get('avg_loss', 0.0),
                train_metrics.get('avg_grad_norm', 0.0),
                train_metrics.get('avg_triplets', 0.0),
                train_metrics.get('total_time', 0.0),
                val_metrics.get('eer', 0.0),
                val_metrics.get('auc', 0.0),
                val_metrics.get('eval_time', 0.0),
                learning_rate,
                miner_mode,
                best_eer,
                stagnation_epochs,
                total_time
            ])

    def _log_test_metrics(self, metrics_file: str, test_metrics: dict, total_time: float):
        """Log final test metrics to CSV file."""
        with open(metrics_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'FINAL_TEST',
                0.0,  # train_loss
                0.0,  # train_grad_norm
                0.0,  # train_triplets
                0.0,  # train_time
                test_metrics.get('eer', 0.0),
                test_metrics.get('auc', 0.0),
                test_metrics.get('eval_time', 0.0),
                0.0,  # learning_rate
                'test',  # miner_mode
                test_metrics.get('eer', 0.0),  # best_eer
                0,  # stagnation_epochs
                total_time
            ])

    def _create_data_splits(self, dataset: LmdbSignatureDataset):
        """Create train/val/test splits based on user codes."""
        # Get all unique user codes
        user_codes = set()
        for i in range(len(dataset)):
            _, _, _, user_code = dataset[i]  # dataset has return_user_code=True
            user_codes.add(user_code)
        
        user_codes = list(user_codes)
        random.shuffle(user_codes)
        
        # Calculate split sizes
        total_users = len(user_codes)
        train_users = int(total_users * self.train_cfg.train_ratio)
        val_users = int(total_users * self.train_cfg.val_ratio)
        
        train_user_codes = user_codes[:train_users]
        val_user_codes = user_codes[train_users:train_users + val_users]
        test_user_codes = user_codes[train_users + val_users:]
        
        self.log(f"Data splits: Train={len(train_user_codes)} users, "
                f"Val={len(val_user_codes)} users, Test={len(test_user_codes)} users")
        
        return train_user_codes, val_user_codes, test_user_codes

    def _create_dataset_sample(self, dataset: LmdbSignatureDataset) -> LmdbSignatureDataset:
        """Create a sample of dataset for quick testing."""
        if self.dataset_cfg.dataset_sample_ratio is None:
            return dataset
        
        sample_ratio = self.dataset_cfg.dataset_sample_ratio
        total_samples = len(dataset)
        sample_size = int(total_samples * sample_ratio)
        
        self.log(f"Creating dataset sample: {sample_size}/{total_samples} samples ({sample_ratio*100:.1f}%)")
        
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

            def collate_fn(self, batch):
                return self.dataset.collate_fn(batch)

        wrapper = DatasetSampleWrapper(dataset, sample_indices)
        wrapper.collate_fn = wrapper.collate_fn
        return wrapper

    def _create_split_dataset(self, dataset: LmdbSignatureDataset, user_codes: set, return_user_code: bool = False):
        """Create a subset of dataset for specific users."""
        indices = []
        total_samples = len(dataset)
        
        self.log(f"Scanning {total_samples} samples for user codes...")
        
        for i in range(total_samples):
            # dataset всегда имеет return_user_code=True, поэтому всегда возвращает 4 значения
            _, _, _, user_code = dataset[i]
            if user_code in user_codes:
                indices.append(i)
            
            # Show progress every 1000 samples
            if (i + 1) % 1000 == 0 or (i + 1) == total_samples:
                progress = (i + 1) / total_samples * 100
                self.log(f"Progress: {i + 1}/{total_samples} ({progress:.1f}%) - Found {len(indices)} matching samples")
        
        self.log(f"Found {len(indices)} samples matching {len(user_codes)} users")
        
        # Создаем wrapper для контроля возврата user_code
        class DatasetWrapper:
            def __init__(self, dataset, indices, return_user_code):
                self.dataset = dataset
                self.indices = indices
                self.return_user_code = return_user_code

            def __len__(self):
                return len(self.indices)
            
            def __getitem__(self, idx):
                original_idx = self.indices[idx]
                tensor, mask, user_id, user_code = self.dataset[original_idx]
                if self.return_user_code:
                    return tensor, mask, user_id, user_code
                return tensor, mask, user_id
            
            def collate_fn(self, batch):
                """Custom collate function for DataLoader."""
                # Handle both 3-tuple and 4-tuple returns from __getitem__
                if len(batch[0]) == 4:
                    tensors, masks, user_ids, user_codes = zip(*batch)
                else:
                    tensors, masks, user_ids = zip(*batch)
                
                # Stack tensors (all have same size now)
                x_batch = torch.stack(tensors, dim=0)  # (B, T_max, F)
                mask = torch.stack(masks, dim=0)       # (B, T_max)
                labels = torch.tensor(user_ids, dtype=torch.long)  # (B,)
                
                return x_batch, labels, mask
        
        wrapper = DatasetWrapper(dataset, indices, return_user_code)
        wrapper.collate_fn = wrapper.collate_fn  # Добавляем collate_fn как атрибут
        return wrapper

    def run(self) -> None:
        """Main training run method."""
        print("Starting training run...")
        set_seed(self.train_cfg.seed)
        device = resolve_device(self.train_cfg.device)

        # Setup output directories
        checkpoint_dir, log_dir, export_dir, run_name = self._setup_output_dirs()
        
        # Setup logging
        self._setup_logging(log_dir)
        
        # Setup metrics logging
        metrics_file = self._setup_metrics_logging(log_dir)
        
        self.log(f"Starting training run: {run_name}")
        self.log(f"Device: {device}")
        self.log(f"Checkpoint dir: {checkpoint_dir}")
        self.log(f"Log dir: {log_dir}")
        self.log(f"Export dir: {export_dir}")
        
        # Log important info to file
        self.log_file(f"Starting training run: {run_name}")
        self.log_file(f"Device: {device}")
        
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
        
        try:
            # Calculate input features: base features (x,y,p,t_norm) + derived features
            # Calculate input features: unique features from feature_pipeline
            # feature_pipeline может содержать как базовые (x, y, p, t), так и производные признаки
            in_features = len(self.dataset_cfg.feature_pipeline)
            
            self.log(f"Input features: {in_features} from feature_pipeline: {self.dataset_cfg.feature_pipeline}")
            
            # Create model
            self.log("Creating model...")
            model = self._create_model(in_features).to(device)
            self.log(f"Model created: {sum(p.numel() for p in model.parameters())} parameters")
            
            # Create full dataset
            self.log("Loading dataset...")
            full_dataset = LmdbSignatureDataset(
                lmdb_path=self.dataset_cfg.lmdb_path,
                max_sequence_length=self.dataset_cfg.max_sequence_length,
                feature_pipeline=self.dataset_cfg.feature_pipeline,
                return_user_code=True
            )
            self.log(f"Full dataset loaded: {len(full_dataset)} samples")
            
            # Create dataset sample if specified
            full_dataset = self._create_dataset_sample(full_dataset)
            self.log(f"Using dataset: {len(full_dataset)} samples")
            
            # Create data splits
            self.log("Creating data splits...")
            train_user_codes, val_user_codes, test_user_codes = self._create_data_splits(full_dataset)
            
            # Create split datasets
            self.log("Creating split datasets...")
            train_dataset = self._create_split_dataset(full_dataset, set(train_user_codes), return_user_code=True)
            val_dataset = self._create_split_dataset(full_dataset, set(val_user_codes))
            test_dataset = self._create_split_dataset(full_dataset, set(test_user_codes))
            
            self.log(f"Dataset sizes: Train={len(train_dataset)}, Val={len(val_dataset)}, Test={len(test_dataset)}")
            
            # Create PK sampler for balanced batches
            self.log("Creating PK sampler...")
            # Get user_codes for train dataset
            train_user_codes = []
            train_dataset_size = len(train_dataset)
            self.log(f"Extracting user codes from {train_dataset_size} train samples...")
            
            for idx in range(train_dataset_size):
                _, _, _, user_code = train_dataset[idx]
                train_user_codes.append(user_code)
                
                # Show progress
                if (idx + 1) % 1000 == 0 or (idx + 1) == train_dataset_size:
                    progress = (idx + 1) / train_dataset_size * 100
                    self.log(f"PK sampler progress: {idx + 1}/{train_dataset_size} ({progress:.1f}%)")
            
            self.log(f"Extracted {len(train_user_codes)} user codes for PK sampling")
            
            pk_sampler = PKSampler(
                labels=train_user_codes,
                P=self.train_cfg.pk_p,  # number of users per batch (из конфига)
                K=self.train_cfg.pk_k,  # samples per user
                shuffle_identities=True
            )
            self.log(f"PK sampler created: P={self.train_cfg.pk_p}, K={self.train_cfg.pk_k}")
            
            train_loader = DataLoader(
                train_dataset,
                batch_sampler=pk_sampler,
                num_workers=self.dataset_cfg.num_workers,
                pin_memory=True,
                collate_fn=train_dataset.collate_fn
            )
            
            # Create validation and test loaders
            self.log("Creating validation and test loaders...")
            val_loader = DataLoader(
                val_dataset,
                batch_size=self.dataset_cfg.batch_size,
                num_workers=self.dataset_cfg.num_workers,
                pin_memory=True,
                collate_fn=val_dataset.collate_fn,
                shuffle=False
            )
            
            test_loader = DataLoader(
                test_dataset,
                batch_size=self.dataset_cfg.batch_size,
                num_workers=self.dataset_cfg.num_workers,
                pin_memory=True,
                collate_fn=test_dataset.collate_fn,
                shuffle=False
            )
            
            # Create optimizer, scheduler, miner, loss
            self.log("Creating optimizer, scheduler, miner, loss...")
            optimizer = self._create_optimizer(model)
            scheduler = self._create_scheduler(optimizer, len(train_loader))
            miner = self._create_miner()
            loss_fn = self._create_loss_fn()
            scaler = GradScaler('cuda') if self.train_cfg.mixed_precision else None
            
            self.log(f"Training setup complete:")
            self.log(f"  - Batches per epoch: {len(train_loader)}")
            self.log(f"  - Learning rate: {self.train_cfg.learning_rate}")
            self.log(f"  - Miner mode: {miner.mode}")
            self.log(f"  - Triplet margin: {self.train_cfg.triplet_margin}")
            
            # Load checkpoint if resuming
            start_epoch = 0
            if self.train_cfg.resume:
                start_epoch = self._load_checkpoint(model, optimizer, scheduler, scaler, checkpoint_dir)
            
            # Training loop
            self.log(f"Starting training for {self.train_cfg.epochs} epochs...")
            best_eer = float('inf')
            stagnation_epochs = 0
            training_start_time = time.time()
            
            for epoch in range(start_epoch, self.train_cfg.epochs):
                epoch_start_time = time.time()
                self.log(f"\n=== Epoch {epoch+1}/{self.train_cfg.epochs} ===")
                
                # Train one epoch
                train_metrics = train_one_epoch(
                    model=model,
                    dataloader=train_loader,
                    optimizer=optimizer,
                    scheduler=scheduler,
                    miner=miner,
                    loss_fn=loss_fn,
                    device=device,
                    scaler=scaler,
                    grad_accum_steps=1,
                    logger=self.logger,
                    log_frequency=self.train_cfg.log_frequency
                )
                
                # Validation on separate validation set
                self.log("Starting validation...")
                val_start_time = time.time()
                try:
                    val_eer, val_auc = evaluate(model, val_loader, device, self.logger)
                    val_metrics = {
                        'eer': val_eer,
                        'auc': val_auc,
                        'eval_time': time.time() - val_start_time
                    }
                    self.log(f"Validation - EER: {val_eer:.4f}, AUC: {val_auc:.4f}")
                except Exception as e:
                    self.log(f"Validation failed: {e}")
                    val_metrics = {'eer': 1.0, 'auc': 0.5, 'eval_time': 0.0}
                
                # Save checkpoint
                self._save_checkpoint(model, optimizer, scheduler, scaler, epoch, checkpoint_dir)
                
                # Mining mode switching logic
                if train_metrics["avg_loss"] < 0.1:  # If loss is very low, switch to hard mining
                    if miner.mode == "semi-hard":
                        miner.set_mode("hard")
                        # Reduce learning rate
                        for param_group in optimizer.param_groups:
                            param_group['lr'] *= self.train_cfg.lr_reduction_factor
                        self.log("Switched to hard mining and reduced LR by 0.5x")
                
                # Early stopping check based on validation EER
                if val_metrics['eer'] < best_eer:
                    best_eer = val_metrics['eer']
                    stagnation_epochs = 0
                    self._save_checkpoint(model, optimizer, scheduler, scaler, epoch, checkpoint_dir, is_best=True)
                    self.log(f"New best EER: {best_eer:.4f}")
                else:
                    stagnation_epochs += 1
                
                # Check for early stopping
                if stagnation_epochs >= self.train_cfg.early_stopping_patience:
                    self.log(f"Early stopping after {epoch+1} epochs (no improvement for {stagnation_epochs} epochs)")
                    break
                
                # Log epoch metrics to CSV
                epoch_time = time.time() - epoch_start_time
                total_time = time.time() - training_start_time
                current_lr = optimizer.param_groups[0]['lr']
                
                self._log_epoch_metrics(
                    metrics_file=metrics_file,
                    epoch=epoch,
                    train_metrics=train_metrics,
                    val_metrics=val_metrics,
                    learning_rate=current_lr,
                    miner_mode=miner.mode,
                    best_eer=best_eer,
                    stagnation_epochs=stagnation_epochs,
                    total_time=total_time
                )
                
                # Log epoch summary
                self.log(f"Epoch {epoch+1} Summary:")
                self.log(f"  Train Loss: {train_metrics['avg_loss']:.4f}")
                self.log(f"  Val EER: {val_metrics['eer']:.4f}, Val AUC: {val_metrics['auc']:.4f}")
                self.log(f"  Best EER: {best_eer:.4f}")
                self.log(f"  LR: {current_lr:.6f}, Miner: {miner.mode}")
                self.log(f"  Epoch Time: {epoch_time:.2f}s")
            
            # Final test evaluation
            self.log("\n" + "=" * 80)
            self.log("FINAL TEST EVALUATION")
            self.log("=" * 80)
            
            test_start_time = time.time()
            try:
                test_eer, test_auc = evaluate(model, test_loader, device, self.logger)
                test_metrics = {
                    'eer': test_eer,
                    'auc': test_auc,
                    'eval_time': time.time() - test_start_time
                }
                self.log(f"FINAL TEST RESULTS:")
                self.log(f"  Test EER: {test_eer:.4f}")
                self.log(f"  Test AUC: {test_auc:.4f}")
                self.log(f"  Evaluation Time: {test_metrics['eval_time']:.2f}s")
                
                # Log test metrics to CSV
                total_time = time.time() - training_start_time
                self._log_test_metrics(metrics_file, test_metrics, total_time)
                
            except Exception as e:
                self.log(f"Final test evaluation failed: {e}")
                test_metrics = {'eer': 1.0, 'auc': 0.5, 'eval_time': 0.0}
            
            self.log("=" * 80)
            self.log("Training completed successfully!")
            self.log("=" * 80)
            
            # Log completion to file
            self.log_file("Training completed successfully!")
            
        except Exception as e:
            self.log(f"Training failed: {e}")
            self.log_file(f"Training failed: {e}")
            raise e