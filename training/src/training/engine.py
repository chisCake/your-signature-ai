import torch
from torch.amp import autocast, GradScaler
from tqdm import tqdm
import numpy as np
import logging
from typing import Dict, Any, Optional, Tuple
import time

from .metrics import compute_eer_auc


def get_vram_info() -> str:
    """
    Get current VRAM usage information for display in tqdm.
    Returns formatted string with allocated and reserved memory in GB.
    """
    if not torch.cuda.is_available():
        return "N/A"

    allocated = torch.cuda.memory_allocated() / 1024**3  # GB
    reserved = torch.cuda.memory_reserved() / 1024**3  # GB
    return f"{allocated:.2f}/{reserved:.2f}GB"


def train_one_epoch(
    model,
    dataloader,
    optimizer,
    scheduler,
    miner,
    loss_fn,
    device,
    scaler: GradScaler = None,
    grad_accum_steps: int = 1,
    grad_clip_max_norm: float = 1.0,
    logger: Optional[logging.Logger] = None,
    log_frequency: int = 1,  # Default: update every batch (overridden by config)
) -> Dict[str, Any]:
    """
    Train model for one epoch with comprehensive error handling and metrics logging.

    Args:
        model: Model to train
        dataloader: Training data loader
        optimizer: Optimizer
        scheduler: Learning rate scheduler
        miner: Triplet miner
        loss_fn: Loss function
        device: Device to train on
        scaler: Gradient scaler for AMP
        grad_accum_steps: Gradient accumulation steps
        logger: Logger instance

    Returns:
        Dictionary with epoch metrics
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    model.train()
    running_loss = 0.0
    optimizer.zero_grad()

    if scaler is None:
        scaler = GradScaler()

    # Initialize metrics tracking
    epoch_metrics = {
        "losses": [],
        "grad_norms": [],
        "triplet_counts": [],
        "batch_times": [],
        "learning_rates": [],
        "margin_violations": [],
        "avg_anchor_pos_dists": [],
        "avg_anchor_neg_dists": [],
        "valid_batches": 0,
        "total_batches": 0,
        "oom_errors": 0,
        "nan_losses": 0,
        "nan_embeddings": 0,
        "nan_distances": 0,
        "empty_triplets": 0,
    }

    step = 0
    start_time = time.time()
    grad_norm = None  # Initialize grad_norm

    logger.info(f"Starting training epoch with {len(dataloader)} batches")
    logger.info(f"Gradient accumulation steps: {grad_accum_steps}")

    # Create progress bar with dynamic postfix
    pbar = tqdm(dataloader, desc="train", unit="batch")
    for batch_idx, batch in enumerate(pbar):
        batch_start_time = time.time()
        epoch_metrics["total_batches"] += 1

        try:
            x, labels, mask = batch  # expected collate -> x: (B,T,F), labels: (B,)
            x = x.to(device, non_blocking=True)
            labels = labels.to(device)
            if mask is not None:
                mask = mask.to(device)

            # Forward pass with AMP
            with autocast("cuda"):
                emb = model(x, mask)

                # Debug: check embeddings for NaN/Inf
                if torch.isnan(emb).any() or torch.isinf(emb).any():
                    logger.error(f"Batch {batch_idx}: NaN/Inf detected in embeddings")
                    logger.error(
                        f"  Embedding stats: min={emb.min().item():.6f}, max={emb.max().item():.6f}"
                    )
                    logger.error(
                        f"  Input stats: min={x.min().item():.6f}, max={x.max().item():.6f}"
                    )
                    epoch_metrics["nan_embeddings"] += 1
                    continue

                a, p, n = miner(emb, labels)

                # Check for empty triplets
                if a.size(0) == 0:
                    epoch_metrics["empty_triplets"] += 1
                    logger.warning(f"Batch {batch_idx}: No triplets found, skipping")
                    continue

                # Debug: check triplet distances
                pos_dist = torch.cdist(a, p, p=2).mean()
                neg_dist = torch.cdist(a, n, p=2).mean()

                if (
                    torch.isnan(pos_dist)
                    or torch.isinf(pos_dist)
                    or torch.isnan(neg_dist)
                    or torch.isinf(neg_dist)
                ):
                    logger.error(f"Batch {batch_idx}: NaN/Inf in triplet distances")
                    logger.error(
                        f"  Pos dist: {pos_dist.item():.6f}, Neg dist: {neg_dist.item():.6f}"
                    )
                    epoch_metrics["nan_distances"] += 1
                    continue

                loss = loss_fn(a, p, n)

            # Check for invalid loss values
            if torch.isnan(loss) or torch.isinf(loss):
                epoch_metrics["nan_losses"] += 1
                logger.error(f"Batch {batch_idx}: Invalid loss {loss.item()}")
                logger.error(
                    f"  Anchor stats: min={a.min().item():.6f}, max={a.max().item():.6f}"
                )
                logger.error(
                    f"  Positive stats: min={p.min().item():.6f}, max={p.max().item():.6f}"
                )
                logger.error(
                    f"  Negative stats: min={n.min().item():.6f}, max={n.max().item():.6f}"
                )
                logger.error(
                    "CRITICAL ERROR: NaN/Inf loss detected. Training cannot continue."
                )
                logger.error(
                    "This usually indicates model collapse or numerical instability."
                )
                raise RuntimeError(
                    f"Invalid loss value: {loss.item()}. Training stopped."
                )

            # Compute mining metrics
            anchor_pos_dist = torch.cdist(a, p, p=2).mean().item()
            anchor_neg_dist = torch.cdist(a, n, p=2).mean().item()
            margin_violations = (
                1
                if (anchor_neg_dist - anchor_pos_dist < miner.margin)
                and hasattr(miner, "margin")
                else 0
            )

            # Store mining metrics
            epoch_metrics["avg_anchor_pos_dists"].append(anchor_pos_dist)
            epoch_metrics["avg_anchor_neg_dists"].append(anchor_neg_dist)
            epoch_metrics["margin_violations"].append(margin_violations)
            epoch_metrics["triplet_counts"].append(a.size(0))

            # Backward pass with gradient accumulation
            # Divide loss by grad_accum_steps to maintain effective learning rate
            # This is standard PyTorch practice for gradient accumulation
            loss = loss / grad_accum_steps
            scaler.scale(loss).backward()
            step += 1

            if step % grad_accum_steps == 0:
                # Gradient clipping
                scaler.unscale_(optimizer)
                grad_norm = torch.nn.utils.clip_grad_norm_(
                    model.parameters(),
                    max_norm=grad_clip_max_norm,  # Applied to accumulated gradients
                )

                # Check for gradient explosion
                if torch.isnan(grad_norm) or torch.isinf(grad_norm):
                    logger.error(
                        f"Batch {batch_idx}: Invalid gradient norm {grad_norm}"
                    )
                    logger.error(
                        "CRITICAL ERROR: NaN/Inf gradients detected. Training cannot continue."
                    )
                    logger.error(
                        "This indicates severe numerical instability in the model."
                    )
                    raise RuntimeError(
                        f"Invalid gradient norm: {grad_norm}. Training stopped."
                    )

                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()

                # Scheduler step with error handling
                if scheduler is not None:
                    try:
                        scheduler.step()
                    except Exception as e:
                        logger.warning(f"Batch {batch_idx}: Scheduler step failed: {e}")
                        # Continue training even if scheduler fails

                # Store metrics
                epoch_metrics["grad_norms"].append(grad_norm.item())
                epoch_metrics["learning_rates"].append(optimizer.param_groups[0]["lr"])

            # Store loss and timing
            # Multiply by grad_accum_steps to show "effective" loss per batch
            # (loss was divided for gradient accumulation, multiply back for reporting)
            epoch_metrics["losses"].append(loss.item() * grad_accum_steps)
            epoch_metrics["valid_batches"] += 1

            batch_time = time.time() - batch_start_time
            epoch_metrics["batch_times"].append(batch_time)

            # Update progress bar with metrics dynamically (updates in place, no new lines)
            if batch_idx % log_frequency == 0 or batch_idx == len(dataloader) - 1:
                grad_norm_str = (
                    f"{grad_norm.item():.4f}" if grad_norm is not None else "N/A"
                )
                vram_info = get_vram_info()
                # Use set_postfix to update info in the same line as progress bar
                pbar.set_postfix(
                    Loss=f"{loss.item() * grad_accum_steps:.4f}",
                    LR=f"{optimizer.param_groups[0]['lr']:.6f}",
                    Triplets=a.size(0),
                    GradNorm=grad_norm_str,
                    VRAM=vram_info,
                )

        except RuntimeError as e:
            if "out of memory" in str(e):
                epoch_metrics["oom_errors"] += 1
                logger.error(f"Batch {batch_idx}: CUDA out of memory")
                logger.error(
                    "CRITICAL ERROR: GPU memory exhausted. Training cannot continue."
                )
                logger.error(
                    "Solutions: reduce batch size, increase grad_accum_steps, or use smaller model."
                )
                torch.cuda.empty_cache()
                raise RuntimeError(
                    f"CUDA OOM at batch {batch_idx}. Training stopped. "
                    f"Consider reducing batch size or increasing grad_accum_steps."
                )
            else:
                logger.error(f"Batch {batch_idx}: Runtime error: {e}")
                logger.error(
                    "CRITICAL ERROR: Unexpected runtime error. Training stopped."
                )
                raise e
        except Exception as e:
            logger.error(f"Batch {batch_idx}: Unexpected error: {e}")
            logger.error("CRITICAL ERROR: Unexpected error occurred. Training stopped.")
            raise e

    # Calculate final metrics
    total_time = time.time() - start_time
    avg_loss = np.mean(epoch_metrics["losses"]) if epoch_metrics["losses"] else 0.0
    avg_grad_norm = (
        np.mean(epoch_metrics["grad_norms"]) if epoch_metrics["grad_norms"] else 0.0
    )
    avg_triplets = (
        np.mean(epoch_metrics["triplet_counts"])
        if epoch_metrics["triplet_counts"]
        else 0.0
    )

    # Log epoch summary
    print()
    logger.info(
        f"Epoch completed: {epoch_metrics['valid_batches']}/{epoch_metrics['total_batches']} batches"
    )
    logger.info(f"Average loss: {avg_loss:.4f}")
    logger.info(f"Average gradient norm: {avg_grad_norm:.4f}")
    logger.info(f"Average triplets per batch: {avg_triplets:.1f}")
    logger.info(f"Total time: {total_time:.2f}s")

    if epoch_metrics["oom_errors"] > 0:
        logger.warning(f"OOM errors: {epoch_metrics['oom_errors']}")
    if epoch_metrics["nan_losses"] > 0:
        logger.warning(f"NaN losses: {epoch_metrics['nan_losses']}")
    if epoch_metrics["empty_triplets"] > 0:
        logger.warning(f"Empty triplets: {epoch_metrics['empty_triplets']}")

    return {
        "avg_loss": avg_loss,
        "avg_grad_norm": avg_grad_norm,
        "avg_triplets": avg_triplets,
        "total_time": total_time,
        "valid_batches": epoch_metrics["valid_batches"],
        "total_batches": epoch_metrics["total_batches"],
        "oom_errors": epoch_metrics["oom_errors"],
        "nan_losses": epoch_metrics["nan_losses"],
        "empty_triplets": epoch_metrics["empty_triplets"],
    }


@torch.no_grad()
def evaluate(
    model, dataloader, device, logger: Optional[logging.Logger] = None
) -> Tuple[float, float]:
    """
    Evaluate model on validation set with comprehensive error handling.

    Args:
        model: Model to evaluate
        dataloader: Validation data loader
        device: Device to evaluate on
        logger: Logger instance

    Returns:
        Tuple of (EER, AUC) metrics
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    model.eval()
    all_emb = []
    all_labels = []

    logger.info(f"Starting evaluation with {len(dataloader)} batches")

    try:
        pbar = tqdm(dataloader, desc="eval")
        for batch_idx, batch in enumerate(pbar):
            try:
                x, labels, mask = batch
                x = x.to(device)
                if mask is not None:
                    mask = mask.to(device)

                emb = model(x, mask)

                # Check for invalid embeddings
                if torch.isnan(emb).any() or torch.isinf(emb).any():
                    logger.error(f"Batch {batch_idx}: Invalid embeddings detected")
                    logger.error(
                        "CRITICAL ERROR: NaN/Inf embeddings. Evaluation cannot continue."
                    )
                    raise RuntimeError("Invalid embeddings detected during evaluation.")

                all_emb.append(emb.cpu())
                all_labels.append(labels)

                # Update progress bar with VRAM info
                vram_info = get_vram_info()
                pbar.set_postfix(VRAM=vram_info)

            except Exception as e:
                logger.error(f"Batch {batch_idx}: Error during evaluation: {e}")
                logger.error(
                    "CRITICAL ERROR: Evaluation failed. Cannot compute metrics."
                )
                raise e

        if not all_emb:
            logger.error("No embeddings collected during evaluation")
            raise RuntimeError("No embeddings collected during evaluation.")

        all_emb = torch.cat(all_emb, dim=0)
        all_labels = torch.cat(all_labels, dim=0)

        print()
        logger.info(f"Evaluation completed: {all_emb.size(0)} samples")

        # Compute metrics
        emb_np = all_emb.numpy()
        labels_np = all_labels.numpy()
        eer, auc = compute_eer_auc(emb_np, labels_np)

        logger.info(f"EER: {eer:.4f}, AUC: {auc:.4f}")

        return eer, auc, emb_np, labels_np

    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        raise e
