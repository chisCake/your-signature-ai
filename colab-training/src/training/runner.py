from dataclasses import dataclass
from typing import Optional, List, Tuple
import os
import random
import numpy as np
import torch.nn.functional as F
import torch
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR
from torch import nn
from torch import amp
from torch.nn.functional import cosine_similarity
from datetime import datetime

from config import DatasetConfig, ModelConfig, TrainingConfig
from data.lmdb_dataset import LmdbSignatureDataset
from models import create_model
from .sampling import PKSampler
from .miners import SemiHardMiner, HardMiner
from .metrics import compute_metrics
import json
import matplotlib.pyplot as plt
import sys
from datetime import datetime as _dt

try:
    from umap import UMAP
except ImportError:
    UMAP = None  # UMAP is optional for visualization


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def resolve_device(pref: Optional[str]) -> torch.device:
    if pref is not None:
        return torch.device(pref)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


# build_model is now delegated to models.create_model factory


class ContrastiveHead(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.sigmoid = nn.Sigmoid()

    def forward(self, emb_a: torch.Tensor, emb_b: torch.Tensor) -> torch.Tensor:
        sim = cosine_similarity(emb_a, emb_b, dim=-1)
        return self.sigmoid(sim)


@dataclass
class TrainingRunner:
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

    def run(self) -> None:
        set_seed(self.train_cfg.seed)
        device = resolve_device(self.train_cfg.device)

        # Setup output directories with timestamp
        checkpoint_dir, log_dir, export_dir, run_name = self._setup_output_dirs()

        # --- Tee stdout/stderr to training.log ---
        class _Tee:
            def __init__(self, stream, logfile_path: str) -> None:
                self.stream = stream
                # open in append mode so resumed runs continue seamlessly
                self.log = open(logfile_path, "a", encoding="utf-8")
            def write(self, data: str) -> None:
                self.stream.write(data)
                self.log.write(data)
            def flush(self) -> None:
                try:
                    self.stream.flush()
                finally:
                    self.log.flush()

        log_file_path = os.path.join(log_dir, "training.log")
        # Robust dual logger: write to console and file explicitly
        if not hasattr(self, "_log_file"):
            self._log_file = open(log_file_path, "a", encoding="utf-8")  # type: ignore[attr-defined]
            self._log_file.write(f"\n===== Session start: {_dt.now().strftime('%Y-%m-%d %H:%M:%S')} =====\n")  # type: ignore[attr-defined]
            self._log_file.flush()  # type: ignore[attr-defined]

        # Tee stdout/stderr to training.log so that tqdm/warnings are captured as well
        try:
            sys.stdout = _Tee(sys.stdout, log_file_path)  # type: ignore[assignment]
            sys.stderr = _Tee(sys.stderr, log_file_path)  # type: ignore[assignment]
        except Exception:
            pass

        # Simple logger helper that writes to both console and file
        def log(msg: str) -> None:
            print(msg)
            try:
                self._log_file.write(msg + "\n")  # type: ignore[attr-defined]
                self._log_file.flush()  # type: ignore[attr-defined]
            except Exception:
                pass

        # Data: base dataset (with user_code)
        # NOTE: x,y,p are already normalized in build_dataset.py
        base_ds = LmdbSignatureDataset(
            lmdb_path=self.dataset_cfg.lmdb_path,
            max_sequence_length=self.dataset_cfg.max_sequence_length,
            feature_pipeline=self.dataset_cfg.feature_pipeline,
            return_user_code=True,
        )

        # Build per-user indices
        from collections import defaultdict

        user_codes: List[str] = []
        for i in range(len(base_ds)):
            try:
                # Unpack the last element as user_code, ignoring the rest
                *_, uc = base_ds[i]
            except Exception:
                uc = ""
            user_codes.append(uc)

        per_user: dict[str, List[int]] = defaultdict(list)
        for idx, uc in enumerate(user_codes):
            per_user[uc].append(idx)

        train_idx: List[int] = []
        val_idx: List[int] = []
        test_idx: List[int] = []
        # Split strategy: by users (default) or per-sample within each user
        if getattr(self.train_cfg, "split_by_users", True):
            users = list(per_user.keys())
            random.shuffle(users)
            nu = len(users)
            n_train_users = int(nu * self.train_cfg.train_ratio)
            n_val_users = int(nu * self.train_cfg.val_ratio)
            train_users = set(users[:n_train_users])
            val_users = set(users[n_train_users : n_train_users + n_val_users])
            test_users = set(users[n_train_users + n_val_users :])
            for uc, idxs in per_user.items():
                if uc in train_users:
                    train_idx.extend(idxs)
                elif uc in val_users:
                    val_idx.extend(idxs)
                else:
                    test_idx.extend(idxs)
        else:
            for uc, idxs in per_user.items():
                n = len(idxs)
                if n == 0:
                    continue
                random.shuffle(idxs)
                n_train = int(n * self.train_cfg.train_ratio)
                n_val = int(n * self.train_cfg.val_ratio)
                train_idx.extend(idxs[:n_train])
                val_idx.extend(idxs[n_train : n_train + n_val])
                test_idx.extend(idxs[n_train + n_val :])

        # Setup augmentation
        from data.augmentation import SignatureAugmentation, NoAugmentation
        
        if self.dataset_cfg.augment:
            train_transform = SignatureAugmentation(
                time_warp_prob=0.3,
                time_warp_sigma=0.2,
                noise_prob=0.3,
                noise_sigma=0.01,
                rotation_prob=0.2,
                rotation_range=5.0,
                scale_prob=0.2,
                scale_range=(0.9, 1.1),
                dropout_prob=0.1,
                dropout_rate=0.05,
                time_resample_prob=0.0,  # DISABLED: causing NaN issues
                resample_range=(300, 800),
            )
            log("✓ Training augmentation enabled")
        else:
            train_transform = NoAugmentation()
            log("ℹ Training augmentation disabled")
        
        val_transform = NoAugmentation()  # Never augment validation/test
        
        # View datasets applying feature pipeline and channel arrangement
        class _View(torch.utils.data.Dataset):
            def __init__(self, base, indices, dataset_cfg, transform=None):
                self.base = base
                self.idxs = indices
                self.cfg = dataset_cfg
                self.transform = transform

            def __len__(self):
                return len(self.idxs)

            def __getitem__(self, i):
                t, mask, label, uc = self.base[self.idxs[i]]
                # Apply augmentation if provided
                if self.transform is not None:
                    t = self.transform(t)
                # features already computed in base_ds; tensor shape [T, C]
                y = 1 if label == "genuine" else 0
                return t, mask, torch.tensor(y, dtype=torch.long), uc

        ds_train = _View(base_ds, train_idx, self.dataset_cfg, transform=train_transform)
        ds_val = _View(base_ds, val_idx, self.dataset_cfg, transform=val_transform)

        # Save configuration to JSON with dataset statistics
        from dataclasses import asdict

        config_dict = {
            "run_name": run_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": asdict(self.dataset_cfg),
            "model": asdict(self.model_cfg),
            "training": asdict(self.train_cfg),
            "dataset_stats": {
                "total_users": len(per_user),
                "total_samples": len(base_ds),
                "train_samples": len(train_idx),
                "val_samples": len(val_idx),
                "test_samples": len(test_idx),
                "train_ratio_actual": (
                    round(len(train_idx) / len(base_ds), 4) if len(base_ds) > 0 else 0
                ),
                "val_ratio_actual": (
                    round(len(val_idx) / len(base_ds), 4) if len(base_ds) > 0 else 0
                ),
                "test_ratio_actual": (
                    round(len(test_idx) / len(base_ds), 4) if len(base_ds) > 0 else 0
                ),
            },
        }
        config_path = os.path.join(os.path.dirname(checkpoint_dir), "config.json")

        # Update config with target sampler parameters (K will be set per-epoch)
        config_dict["training"]["pk_sampler"] = {"target_K": int(self.train_cfg.pk_k)}
        # Colab + LMDB can be unstable with >0 workers. Force 0 on Colab.
        num_workers = self.dataset_cfg.num_workers
        try:
            import google.colab  # type: ignore

            if num_workers > 0:
                print("note: Colab detected, forcing num_workers=0 for LMDB stability")
                num_workers = 0
        except Exception:
            pass

        # Force num_workers=0 on Windows to avoid multiprocessing issues
        if os.name == "nt":  # Windows
            if num_workers > 0:
                print(
                    "note: Windows detected, forcing num_workers=0 for multiprocessing stability"
                )
                num_workers = 0
        pin_mem = device.type == "cuda"
        # loader will be constructed per-epoch to support dynamic P/K
        # Use a smaller batch size for validation to reduce memory footprint
        val_batch_size = min(16, self.dataset_cfg.batch_size)
        val_loader = DataLoader(
            ds_val,
            batch_size=val_batch_size,
            shuffle=False,
            num_workers=num_workers,
            persistent_workers=False,
            pin_memory=pin_mem,
        )

        # Model + head
        # infer input channels from one sample
        sample_x, _, _, _ = ds_train[0]
        in_channels = sample_x.size(-1)  # [T, C]

        # Update config with actual input channels and save final configuration
        config_dict["model"]["in_channels"] = in_channels
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False, sort_keys=False)
        log(f"✓ Saved configuration to: {config_path}")

        # Dump full configurations for reproducibility
        try:
            from dataclasses import asdict as _asdict
            log("\n--- dataset_cfg ---\n" + json.dumps(_asdict(self.dataset_cfg), indent=2, ensure_ascii=False))
            log("\n--- model_cfg ---\n" + json.dumps(_asdict(self.model_cfg), indent=2, ensure_ascii=False))
            log("\n--- train_cfg ---\n" + json.dumps(_asdict(self.train_cfg), indent=2, ensure_ascii=False))
        except Exception:
            pass

        # Build kwargs for model from ModelConfig, excluding None values
        model_kwargs = {}
        for key in [
            "cnn_channels",
            "lstm_hidden",
            "lstm_layers",
            "attn_heads",
            "dropout",
        ]:
            val = getattr(self.model_cfg, key, None)
            if val is not None:
                model_kwargs[key] = val

        model = create_model(
            self.model_cfg.name,
            in_channels=in_channels,
            embedding_dim=self.model_cfg.embedding_dim,
            **model_kwargs,
        ).to(device)
        head = ContrastiveHead().to(device)
        
        # {ДОБАВЛЕНО: Center Loss}/{улучшить компактность внутри класса}/{лучшее разделение между пользователями}
        from .center_loss import CenterLoss, create_user_id_mapping
        
        # Create user ID mapping for center loss
        all_user_codes = [uc for _, _, _, uc in ds_train]  # type: ignore[index]
        user_id_mapping = create_user_id_mapping(all_user_codes)
        num_users = len(user_id_mapping)
        
        center_loss_fn = CenterLoss(
            num_classes=num_users,
            feat_dim=self.model_cfg.embedding_dim,
            device=device,
            lambda_c=0.05  # {УВЕЛИЧЕНО: с 0.01 до 0.05}/{center loss все еще слишком слабый}/{более сильное влияние на компактность классов}
        )
        
        log(f"✓ Center Loss initialized for {num_users} users")
        
        if self.train_cfg.loss_type == "triplet":
            criterion = nn.TripletMarginLoss(
                margin=self.train_cfg.triplet_margin, p=2.0
            )
        else:
            criterion = nn.BCELoss()
            
        # {ДОБАВЛЕНО: center loss optimizer}/{отдельный оптимизатор для центров}/{стабильное обучение центров}
        optimizer_center = AdamW(
            center_loss_fn.parameters(),
            lr=self.train_cfg.learning_rate * 0.1,  # Lower LR for centers
            weight_decay=self.train_cfg.weight_decay,
        )
        
        optimizer = AdamW(
            model.parameters(),
            lr=self.train_cfg.learning_rate,
            weight_decay=self.train_cfg.weight_decay,
        )
        device_type = "cuda" if device.type == "cuda" else "cpu"
        scaler = amp.GradScaler(device_type, enabled=self.train_cfg.mixed_precision)
        # Initial miner (will be updated per epoch if needed)
        miner = (
            SemiHardMiner(self.train_cfg.triplet_margin)
            if self.train_cfg.miner_type == "semi_hard"
            else HardMiner(self.train_cfg.triplet_margin)
        )

        best_eer: Optional[float] = None
        start_epoch: int = 0
        
        # ReduceLROnPlateau scheduler - DISABLED (conflicts with OneCycleLR per-step scheduling)
        # plateau_scheduler = ReduceLROnPlateau(
        #     optimizer, 
        #     mode='min', 
        #     factor=0.7,  # Less aggressive: 0.5 -> 0.7
        #     patience=3,  # More patient: 2 -> 3
        #     min_lr=1e-5  # Higher minimum: 1e-6 -> 1e-5
        # )

        # ---- Verbose setup prints ----
        log("=== TRAIN SETUP ===")
        log(
            f"device={device}  amp={'on' if self.train_cfg.mixed_precision else 'off'} ({'cuda' if device.type=='cuda' else 'cpu'})"
        )
        log(
            f"dataset: users={len(per_user)}  train={len(train_idx)}  val={len(val_idx)}  test={len(test_idx)}"
        )
        log(f"features: C={in_channels} pipeline={self.dataset_cfg.feature_pipeline}")
        log(
            f"sequence: max_len={self.dataset_cfg.max_sequence_length} (x,y,p normalized in build_dataset)"
        )
        # Sampler configuration will be logged per-epoch
        log(
            f"model: name={self.model_cfg.name} embedding_dim={self.model_cfg.embedding_dim}"
        )
        grad_clip = getattr(self.train_cfg, 'grad_clip_max_norm', 1.0)
        warmup_ep = getattr(self.train_cfg, 'warmup_epochs', 3)
        log(
            f"optim: lr={self.train_cfg.learning_rate} weight_decay={self.train_cfg.weight_decay} grad_clip={grad_clip} warmup={warmup_ep}"
        )
        log(
            f"loss={self.train_cfg.loss_type} margin={self.train_cfg.triplet_margin} miner={self.train_cfg.miner_type}/{self.train_cfg.mining_mode}"
        )
        log(
            f"epochs={self.train_cfg.epochs} patience={self.train_cfg.early_stopping_patience} seed={self.train_cfg.seed}"
        )
        log(
            f"artifacts: ckpt={checkpoint_dir} logs={log_dir} export={export_dir} run_name={run_name}"
        )

        # Resume logic: works only if run_name is specified and directory exists
        can_resume = (
            self.train_cfg.resume
            and self.train_cfg.run_name is not None
            and os.path.exists(
                os.path.join(self.train_cfg.output_dir, self.train_cfg.run_name)
            )
        )

        if can_resume:
            best_ckpt = os.path.join(checkpoint_dir, "best.pt")
            if os.path.exists(best_ckpt):
                try:
                    state = torch.load(best_ckpt, map_location=device)

                    # Restore model
                    model.load_state_dict(state.get("model", {}))

                    # Restore optimizer
                    if "optimizer" in state:
                        optimizer.load_state_dict(state["optimizer"])

                    # Restore scaler (for mixed precision)
                    if "scaler" in state:
                        scaler.load_state_dict(state["scaler"])

                    # Restore training state
                    start_epoch = state.get("epoch", 0)
                    best_eer = float(state.get("best_eer", 1.0))

                    log(f"resume: loaded {best_ckpt}")
                    log(f"  → epoch={start_epoch} best_eer={best_eer:.4f}")
                    log(f"  → continuing from epoch {start_epoch + 1}")
                except Exception as e:
                    log(f"resume: failed -> {e}")
                    log("  → starting training from scratch")
                    start_epoch = 0
                    best_eer = None
            else:
                log(f"resume: checkpoint not found at {best_ckpt}")
                log("  → starting training from scratch")
        elif self.train_cfg.resume and self.train_cfg.run_name is None:
            log(
                "resume: skipped (run_name not specified, would create new timestamped directory)"
            )
        elif self.train_cfg.resume:
            log(
                f"resume: skipped (directory {os.path.join(self.train_cfg.output_dir, self.train_cfg.run_name or 'N/A')} does not exist)"
            )

        model.train()
        from tqdm import tqdm

        warmup_k_epochs = 2
        transition_k_epochs = 10
        hard_miner_epoch = 0  # {ИЗМЕНЕНО: с 5 на 0}/{начинать с HardMiner сразу}/{более агрессивный mining с первой эпохи}
        for epoch in range(start_epoch, self.train_cfg.epochs):
            # Build PK sampler: K=4 for better negative mining
            desired_batch = self.dataset_cfg.batch_size
            K = 4  # {было: K=2}/{слишком мало негативных примеров для mining}/{miner сможет выбирать более информативные triplets}
            P = max(2, int(desired_batch // K))
            
            # Switch to HardMiner after epoch 5 for harder negative mining
            if epoch >= hard_miner_epoch and self.train_cfg.miner_type in ("semi_hard", "hard"):
                miner = HardMiner(self.train_cfg.triplet_margin, length_tolerance_ratio=self.train_cfg.length_tolerance_ratio)
                if epoch == hard_miner_epoch:
                    log(f"Switched to HardMiner at epoch {epoch+1}")
            
            sampler = PKSampler([uc for _, _, _, uc in ds_train], P=P, K=K)  # type: ignore[index]
            loader = DataLoader(
                ds_train,
                batch_size=P * K,
                sampler=sampler,
                num_workers=num_workers,
                persistent_workers=False,
                pin_memory=pin_mem,
            )
            log(f"Epoch {epoch+1}: sampler P={P} K={K} steps={len(loader)}")
            # {ИЗМЕНЕНО: ReduceLROnPlateau scheduler}/{как в успешной delta_reworked модели}/{правильное расписание LR на основе EER}
            from torch.optim.lr_scheduler import ReduceLROnPlateau
            scheduler = ReduceLROnPlateau(
                optimizer,
                mode='min',  # Минимизируем EER
                factor=0.1,  # Уменьшаем LR в 10 раз
                patience=3,  # Ждем 3 эпохи без улучшения
                min_lr=1e-6  # Минимальный LR
            )
            total_loss = 0.0
            seen_samples = 0
            non_finite_steps = 0
            total_steps = 0
            pbar = tqdm(
                loader, desc=f"Epoch {epoch+1}/{self.train_cfg.epochs}", ncols=100
            )
            for x, mask, y, uc in pbar:
                x = x.to(device)
                mask = mask.to(device)
                # sanitize inputs to avoid NaNs/Infs propagating
                x = torch.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
                y = y.to(device)
                
                # {ДОБАВЛЕНО: преобразование user codes в integer IDs}/{center loss требует числовые ID}/{совместимость с center loss}
                user_ids = torch.tensor([user_id_mapping.get(code, 0) for code in uc], device=device)
                
                optimizer.zero_grad(set_to_none=True)
                optimizer_center.zero_grad(set_to_none=True)
                
                with amp.autocast(device_type, enabled=self.train_cfg.mixed_precision):
                    emb = model(x, mask=mask)
                    # {ВОССТАНОВЛЕНО: L2 нормализация}/{как в успешной delta_reworked модели}/{стабильное обучение с нормализованными embeddings}
                    emb = F.normalize(emb, p=2, dim=1)
                    if self.train_cfg.loss_type == "triplet":
                        # Compute sequence lengths from mask to restrict negatives by length if configured
                        lengths = mask.sum(dim=1).to(emb.dtype)
                        a, p, n = miner(emb, y, lengths=lengths)
                        if a.numel() == 0:
                            total_steps += 1
                            continue
                        triplet_loss = criterion(emb[a], emb[p], emb[n])
                        
                        # {УДАЛЕНО: Center Loss}/{упрощение как в успешной delta_reworked модели}/{фокус на triplet loss}
                        loss = triplet_loss
                    else:
                        preds = head(emb, emb)
                        labels_t = torch.ones(preds.size(0), device=device)
                        loss = criterion(preds, labels_t)
                # Guard against non-finite loss
                if not torch.isfinite(loss):
                    non_finite_steps += 1
                    total_steps += 1
                    continue
                scaler.scale(loss).backward()
                # Grad clipping for stability under AMP
                try:
                    scaler.unscale_(optimizer)
                    grad_clip_norm = getattr(self.train_cfg, 'grad_clip_max_norm', 1.0)
                    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=grad_clip_norm)
                except Exception:
                    pass
                 scaler.step(optimizer)
                 scaler.update()
                 
                 # {УДАЛЕНО: обновление центров}/{упрощение как в успешной delta_reworked модели}/{фокус на triplet loss}
                 
                 # {УДАЛЕНО: scheduler.step()}/{StepLR должен вызываться после эпохи, а не после каждого шага}/{правильное расписание LR}
                # Accumulate only finite losses
                li = float(loss.item())
                if np.isfinite(li):
                    total_loss += li * x.size(0)
                    seen_samples += x.size(0)
                    pbar.set_postfix({"loss": f"{li:.4f}"})
                else:
                    pbar.set_postfix({"loss": "nan"})
                total_steps += 1

            avg_loss = total_loss / max(1, seen_samples)
            
            # {ДОБАВЛЕНО: принудительное перевычисление валидации}/{предотвращение кэширования результатов}/{гарантия что EER будет изменяться}
            model.eval()
            ys: List[int] = []
            scores: List[float] = []
            # Принудительно очищаем кэш для валидации
            torch.cuda.empty_cache()
            # Принудительно перевычисляем embeddings
            model.zero_grad()
            # Принудительно перевычисляем модель
            for param in model.parameters():
                param.requires_grad_(False)
            for param in model.parameters():
                param.requires_grad_(True)
            with torch.no_grad():
                # Collect per-user embeddings (up to N per user for speed)
                from collections import defaultdict

                per_uc_embs: dict[str, List[torch.Tensor]] = defaultdict(list)
                cap_per_user = 6
                log("  Computing validation embeddings...")
                for vx, vmask, vy, vuc in tqdm(
                    val_loader, desc="  Val", ncols=100, leave=False
                ):
                    vx = vx.to(device)
                    vmask = vmask.to(device)
                    vx = torch.nan_to_num(vx, nan=0.0, posinf=0.0, neginf=0.0)
                    # {ВОССТАНОВЛЕНО: L2 нормализация}/{как в успешной delta_reworked модели}/{стабильное обучение с нормализованными embeddings}
                    emb = model(vx, mask=vmask)
                    emb = F.normalize(emb, p=2, dim=1)
                    # REMOVED: L2 normalization (must match training)
                    for e, uc in zip(emb, vuc):
                        if not torch.isfinite(e).all():
                            continue
                        if len(per_uc_embs[uc]) < cap_per_user:
                            per_uc_embs[uc].append(e.cpu())
                # Build pairs: genuine (same uc) and impostor (different uc)
                ucs = list(per_uc_embs.keys())
                for i, uc in enumerate(ucs):
                    es = per_uc_embs[uc]
                    # genuine pairs
                    for a in range(len(es)):
                        for b in range(a + 1, len(es)):
                            s = cosine_similarity(
                                es[a].unsqueeze(0), es[b].unsqueeze(0)
                            ).item()
                            scores.append(float(s))
                            ys.append(1)
                    # impostor pairs vs next identities (limit to keep runtime small)
                    for j in range(i + 1, min(i + 4, len(ucs))):
                        uc2 = ucs[j]
                        for ea in es[:2]:
                            for eb in per_uc_embs[uc2][:2]:
                                s = cosine_similarity(
                                    ea.unsqueeze(0), eb.unsqueeze(0)
                                ).item()
                                scores.append(float(s))
                                ys.append(0)
            # {ДОБАВЛЕНО: детальное логирование валидации}/{отслеживание количества пар и scores}/{понимание почему EER не изменяется}
            log(f"  Validation: {len(ys)} pairs, scores range: [{min(scores):.4f}, {max(scores):.4f}]")
            # Добавляем детальную статистику scores
            scores_arr = np.array(scores)
            log(f"  Scores stats: mean={scores_arr.mean():.4f}, std={scores_arr.std():.4f}, min={scores_arr.min():.4f}, max={scores_arr.max():.4f}")
            
            m = compute_metrics(
                np.array(ys, dtype=np.int32), np.array(scores, dtype=np.float32)
            )
            
            current_lr = optimizer.param_groups[0]['lr']
            
            if non_finite_steps > 0 and total_steps > 0:
                pct = 100.0 * non_finite_steps / max(1, total_steps)
                log(
                    f"warn: skipped {non_finite_steps}/{total_steps} non-finite steps this epoch ({pct:.1f}%)"
                )
             # {УПРОЩЕНО: логирование только triplet loss}/{как в успешной delta_reworked модели}/{фокус на triplet loss}
             if self.train_cfg.loss_type == "triplet":
                 log(
                     f"epoch={epoch+1}/{self.train_cfg.epochs} loss={avg_loss:.4f} eer={m['eer']:.4f} auc={m['roc_auc']:.4f} acc={m['acc']:.4f} lr={current_lr:.2e}"
                 )
             else:
                 log(
                     f"epoch={epoch+1}/{self.train_cfg.epochs} loss={avg_loss:.4f} eer={m['eer']:.4f} auc={m['roc_auc']:.4f} acc={m['acc']:.4f} lr={current_lr:.2e}"
                 )

            # {УПРОЩЕНО: логирование только mining stats}/{как в успешной delta_reworked модели}/{фокус на triplet loss}
            if epoch == 0 or epoch % 2 == 0:  # Логируем каждые 2 эпохи
                log(f"  Mining stats: miner={miner.__class__.__name__}, K={K}, P={P}")
            
            # Append JSON log
            with open(
                os.path.join(log_dir, "metrics.jsonl"), "a", encoding="utf-8"
            ) as f:
                f.write(json.dumps({"epoch": epoch + 1, "loss": avg_loss, **m}) + "\n")

            # Save best checkpoint on EER improvement
            improved = best_eer is None or (m["eer"] < best_eer)
            if improved:
                best_eer = m["eer"]
                 torch.save(
                     {
                         "epoch": epoch + 1,
                         "model": model.state_dict(),
                         "optimizer": optimizer.state_dict(),
                         "scaler": scaler.state_dict(),
                         "best_eer": best_eer,
                     },
                     os.path.join(checkpoint_dir, "best.pt"),
                 )
                # Export plots with epoch number
                try:
                    from sklearn.metrics import roc_curve, auc, confusion_matrix
                    import scipy.stats as stats

                    ys_arr = np.array(ys)
                    scores_arr = np.array(scores)
                    fpr, tpr, thresholds = roc_curve(ys_arr, scores_arr)
                    roc_auc = auc(fpr, tpr)

                    # Find EER point
                    fnr = 1 - tpr
                    eer_idx = np.nanargmin(np.abs(fnr - fpr))
                    eer_value = (fnr[eer_idx] + fpr[eer_idx]) / 2.0
                    eer_threshold = thresholds[eer_idx]

                    # 1. ROC Curve with EER point
                    plt.figure(figsize=(6, 5))
                    plt.plot(
                        fpr, tpr, "b-", linewidth=2, label=f"ROC (AUC={roc_auc:.3f})"
                    )
                    plt.plot([0, 1], [0, 1], "k--", linewidth=1, label="Random")
                    plt.plot(
                        fpr[eer_idx],
                        tpr[eer_idx],
                        "ro",
                        markersize=10,
                        label=f"EER={eer_value:.3f}",
                    )
                    plt.xlabel("False Positive Rate", fontsize=11)
                    plt.ylabel("True Positive Rate", fontsize=11)
                    plt.title(
                        f"ROC Curve (Epoch {epoch+1})", fontsize=12, fontweight="bold"
                    )
                    plt.legend(loc="lower right")
                    plt.grid(True, alpha=0.3)
                    plt.tight_layout()
                    plt.savefig(
                        os.path.join(export_dir, f"roc-{epoch+1:03d}.png"), dpi=100
                    )
                    plt.close()

                    # 2. DET Curve (Detection Error Tradeoff)
                    plt.figure(figsize=(6, 5))
                    # Convert to DET scale (probit transform)
                    det_fpr = stats.norm.ppf(np.clip(fpr, 1e-10, 1 - 1e-10))
                    det_fnr = stats.norm.ppf(np.clip(fnr, 1e-10, 1 - 1e-10))
                    plt.plot(det_fpr, det_fnr, "b-", linewidth=2, label="DET Curve")
                    plt.plot(
                        det_fpr[eer_idx],
                        det_fnr[eer_idx],
                        "ro",
                        markersize=10,
                        label=f"EER={eer_value:.3f}",
                    )
                    # Add diagonal line where FPR = FNR
                    diag_range = np.linspace(det_fpr.min(), det_fpr.max(), 100)
                    plt.plot(
                        diag_range, diag_range, "k--", linewidth=1, label="FPR=FNR"
                    )
                    plt.xlabel("False Positive Rate", fontsize=11)
                    plt.ylabel("False Negative Rate", fontsize=11)
                    plt.title(
                        f"DET Curve (Epoch {epoch+1})", fontsize=12, fontweight="bold"
                    )
                    plt.legend(loc="upper right")
                    plt.grid(True, alpha=0.3)
                    plt.tight_layout()
                    plt.savefig(
                        os.path.join(export_dir, f"det-{epoch+1:03d}.png"), dpi=100
                    )
                    plt.close()

                    # 3. Confusion Matrix
                    y_pred = (scores_arr >= eer_threshold).astype(np.int32)
                    cm = confusion_matrix(ys_arr, y_pred)

                    plt.figure(figsize=(6, 5))
                    plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
                    plt.title(
                        f"Confusion Matrix (Epoch {epoch+1})\nThreshold={eer_threshold:.3f}",
                        fontsize=12,
                        fontweight="bold",
                    )
                    plt.colorbar()
                    tick_marks = np.arange(2)
                    plt.xticks(tick_marks, ["Impostor", "Genuine"], fontsize=10)
                    plt.yticks(tick_marks, ["Impostor", "Genuine"], fontsize=10)

                    # Add text annotations
                    thresh = cm.max() / 2.0
                    for i in range(2):
                        for j in range(2):
                            plt.text(
                                j,
                                i,
                                format(cm[i, j], "d"),
                                ha="center",
                                va="center",
                                fontsize=14,
                                color="white" if cm[i, j] > thresh else "black",
                            )

                    plt.ylabel("True Label", fontsize=11)
                    plt.xlabel("Predicted Label", fontsize=11)
                    plt.tight_layout()
                    plt.savefig(
                        os.path.join(export_dir, f"cm-{epoch+1:03d}.png"), dpi=100
                    )
                    plt.close()

                    # 4. EER History Plot (if multiple epochs)
                    # Load history from metrics.jsonl
                    history_file = os.path.join(log_dir, "metrics.jsonl")
                    if os.path.exists(history_file):
                        epochs_history = []
                        eer_history = []
                        with open(history_file, "r", encoding="utf-8") as f:
                            for line in f:
                                try:
                                    data = json.loads(line.strip())
                                    epochs_history.append(data.get("epoch", 0))
                                    eer_history.append(data.get("eer", 1.0))
                                except:
                                    pass

                        if len(epochs_history) > 0:
                            plt.figure(figsize=(8, 5))
                            plt.plot(
                                epochs_history,
                                eer_history,
                                "b-o",
                                linewidth=2,
                                markersize=6,
                            )
                            plt.axhline(
                                y=best_eer,
                                color="r",
                                linestyle="--",
                                linewidth=1.5,
                                label=f"Best EER={best_eer:.4f}",
                            )
                            plt.xlabel("Epoch", fontsize=11)
                            plt.ylabel("Equal Error Rate (EER)", fontsize=11)
                            plt.title("EER History", fontsize=12, fontweight="bold")
                            plt.legend(loc="upper right")
                            plt.grid(True, alpha=0.3)
                            plt.tight_layout()
                            plt.savefig(
                                os.path.join(export_dir, f"eer-{epoch+1:03d}.png"),
                                dpi=100,
                            )
                            plt.close()

                    # 5. UMAP of embeddings on val (color by user, show centroids, silhouette)
                    if UMAP is not None:
                        embs = []
                        user_ids: List[str] = []
                        with torch.no_grad():
                            for vx, vmask, vy, vuc in val_loader:
                                vx = vx.to(device)
                                vmask = vmask.to(device)
                                e = model(vx, mask=vmask)
                                # REMOVED: L2 normalization (must match training/validation)
                                embs.append(e.detach().cpu().numpy())
                                user_ids.extend(list(vuc))
                        if embs:
                            embs_np = np.concatenate(embs, axis=0)
                            reducer = UMAP(
                                n_components=2,
                                n_neighbors=15,
                                min_dist=0.1,
                                n_jobs=-1,
                            )
                            proj = reducer.fit_transform(embs_np)

                            # Map unique users to consistent colors
                            proj = np.asarray(proj)
                            user_ids_np = np.asarray(user_ids)
                            uniq_users = np.unique(user_ids_np)

                            # Use tab20 colormap and repeat if needed
                            cmap = plt.get_cmap("tab20")
                            colors = [cmap(i % 20) for i in range(len(uniq_users))]
                            user_to_color = {u: colors[i] for i, u in enumerate(uniq_users)}

                            # Compute per-user centroids in projected space
                            centroids = {}
                            for u in uniq_users:
                                pts = proj[user_ids_np == u]
                                if len(pts) > 0:
                                    centroids[u] = pts.mean(axis=0)

                            # Compute separation: intra-class similarity - inter-class similarity
                            # Higher is better (same user more similar, different users less similar)
                            sep_str = ""
                            try:
                                if len(uniq_users) >= 2:
                                    intra_sims = []
                                    inter_sims = []
                                    # Sample pairs for efficiency
                                    for i, u in enumerate(uniq_users[:min(20, len(uniq_users))]):
                                        u_embs = embs_np[user_ids_np == u]
                                        if len(u_embs) < 2:
                                            continue
                                        # Intra-class: same user pairs (cosine similarity)
                                        for a in range(min(5, len(u_embs))):
                                            for b in range(a+1, min(5, len(u_embs))):
                                                sim = np.dot(u_embs[a], u_embs[b])  # L2-normalized, so dot = cosine
                                                intra_sims.append(sim)
                                        # Inter-class: different user pairs (limited)
                                        if i < len(uniq_users) - 1:
                                            u2 = uniq_users[i+1]
                                            u2_embs = embs_np[user_ids_np == u2]
                                            for ea in u_embs[:3]:
                                                for eb in u2_embs[:3]:
                                                    sim = np.dot(ea, eb)
                                                    inter_sims.append(sim)
                                    if intra_sims and inter_sims:
                                        intra_mean = np.mean(intra_sims)
                                        inter_mean = np.mean(inter_sims)
                                        separation = intra_mean - inter_mean  # Higher is better
                                        log(f"  Separation: intra={intra_mean:.4f} inter={inter_mean:.4f} sep={separation:.4f}")
                                        sep_str = f" (sep={separation:.3f})"
                            except Exception as e:
                                log(f"  Separation calc failed: {e}")

                            plt.figure(figsize=(16, 14))
                            for u in uniq_users:
                                mask = user_ids_np == u
                                c = user_to_color[u]
                                plt.scatter(
                                    proj[mask, 0],
                                    proj[mask, 1],
                                    s=14,
                                    color=c,
                                    label=str(u),
                                    alpha=0.65,
                                    edgecolors="none",
                                )
                            # Draw centroids
                            for u, c_xy in centroids.items():
                                plt.scatter(c_xy[0], c_xy[1], s=120, color=user_to_color[u], marker="X", edgecolors="k", linewidths=0.6)
                            plt.xlabel("UMAP Dimension 1", fontsize=11)
                            plt.ylabel("UMAP Dimension 2", fontsize=11)
                            plt.title(
                                f"UMAP by user (val only, Epoch {epoch+1})" + sep_str,
                                fontsize=12,
                                fontweight="bold",
                            )
                            # Put legend outside to reduce layout pressure
                            try:
                                ncol = 1 if len(uniq_users) < 12 else 2
                                plt.legend(
                                    bbox_to_anchor=(1.02, 1),
                                    loc="upper left",
                                    fontsize=8,
                                    ncol=ncol,
                                    frameon=False,
                                )
                            except Exception:
                                plt.legend(loc="best", fontsize=8, frameon=False)
                            plt.grid(True, alpha=0.25)
                            # Save with tight bounding box to avoid tight_layout warnings
                            plt.savefig(
                                os.path.join(export_dir, f"umap-{epoch+1:03d}.png"),
                                dpi=150,
                                bbox_inches="tight",
                            )
                            plt.close()
                    else:
                        log("  UMAP not available, skipping visualization")

                    log(f"  ✓ Exported plots: roc, det, cm, eer, umap")
                except Exception as e:
                    log(f"  ✗ Plot export failed: {e}")
                    import traceback

                    traceback.print_exc()
            # Early stopping by EER if patience exhausted
            if self.train_cfg.early_stopping_patience > 0:
                if not hasattr(self, "_best_eer_seen"):
                    self._best_eer_seen = m["eer"]  # type: ignore[attr-defined]
                    self._no_improve = 0  # type: ignore[attr-defined]
                else:
                    if m["eer"] + 1e-6 < self._best_eer_seen:  # type: ignore[attr-defined]
                        self._best_eer_seen = m["eer"]  # type: ignore[attr-defined]
                        self._no_improve = 0  # type: ignore[attr-defined]
                    else:
                        self._no_improve += 1  # type: ignore[attr-defined]
                # Log number of consecutive epochs without EER improvement
                try:
                    log(f"no_improve_epochs={int(self._no_improve)} (best={self._best_eer_seen:.4f})")  # type: ignore[attr-defined]
                except Exception:
                    pass
                if self._no_improve >= self.train_cfg.early_stopping_patience:  # type: ignore[attr-defined]
                    log("Early stopping: no EER improvement")
                    break
            # {ИСПРАВЛЕНО: scheduler.step() вызывается после валидации}/{правильный порядок: optimizer.step() -> scheduler.step()}/{исправление warning и правильное расписание LR}
            scheduler.step(m['eer'])
            
            model.train()
        
        # === FINAL TEST EVALUATION ===
        log("")
        log("="*60)
        log("FINAL EVALUATION ON TEST SET")
        log("="*60)
        try:
            # Create test dataset view (no augmentation for test)
            ds_test = _View(base_ds, test_idx, self.dataset_cfg, transform=val_transform)
            test_loader = torch.utils.data.DataLoader(
                ds_test,
                batch_size=self.dataset_cfg.batch_size,
                shuffle=False,
                num_workers=self.dataset_cfg.num_workers,
            )
            
            # Load best checkpoint
            best_ckpt_path = os.path.join(checkpoint_dir, "best.pt")
            if os.path.exists(best_ckpt_path):
                log(f"Loading best checkpoint from {best_ckpt_path}")
                ckpt = torch.load(best_ckpt_path, map_location=device)
                model.load_state_dict(ckpt["model"])
                log(f"Best EER on validation: {ckpt.get('best_eer', 'N/A')}")
            else:
                log("No best checkpoint found, using final model state")
            
            model.eval()
            test_embs = []
            test_labels = []
            test_user_codes = []
            
            with torch.no_grad():
                for tx, tmask, ty, tuc in tqdm(test_loader, desc="  Test", ncols=100):
                    tx = tx.to(device)
                    tmask = tmask.to(device)
                    tx = torch.nan_to_num(tx, nan=0.0, posinf=0.0, neginf=0.0)
                    emb = model(tx, mask=tmask)
                    # REMOVED: L2 normalization (must match training)
                    if torch.isfinite(emb).all():
                        test_embs.append(emb.cpu())
                        test_labels.append(ty)
                        test_user_codes.extend(tuc)
            
            test_embs = torch.cat(test_embs, 0)
            test_labels = torch.cat(test_labels, 0)
            
            # Compute metrics on test set
            from .metrics import compute_verification_metrics
            test_metrics = compute_verification_metrics(test_embs, test_labels)
            
            log(f"Test EER:     {test_metrics['eer']:.4f}")
            log(f"Test ROC AUC: {test_metrics['roc_auc']:.4f}")
            log(f"Test Accuracy: {test_metrics['acc']:.4f}")
            log("")
            
            # Save test metrics to jsonl
            test_metrics_entry = {
                "phase": "final_test",
                **test_metrics,
                "timestamp": datetime.now().isoformat(),
            }
            with open(os.path.join(log_dir, "metrics.jsonl"), "a") as f:
                f.write(json.dumps(test_metrics_entry) + "\n")
            
            log("✓ Test evaluation completed")
        except Exception as e:
            log(f"✗ Test evaluation failed: {e}")
            import traceback
            traceback.print_exc()
        log("="*60)
        
        try:
            self._log_file.flush()  # type: ignore[attr-defined]
        except Exception:
            pass
