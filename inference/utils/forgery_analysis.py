"""Shared forgery verification helpers (anomaly gate + cosine similarity)."""

from __future__ import annotations

from typing import Optional, Tuple

import torch
import torch.nn.functional as F

from utils.forgery_schemas import ForgeryAnalysisResponse
from utils.model_loader import ModelLoader


def check_candidate_anomaly(
    model_loader: ModelLoader, candidate_embedding: torch.Tensor
) -> Tuple[bool, float, Optional[float]]:
    """
    Returns (is_not_signature, anomaly_score, anomaly_threshold).
  If no detector loaded, (False, 0.0, None).
    """
    if model_loader.anomaly_detector is None:
        return False, 0.0, None

    emb_np = candidate_embedding.detach().cpu().numpy().reshape(-1)
    score = model_loader.anomaly_detector.score(emb_np)
    thr = model_loader.anomaly_detector.threshold
    return score > thr, float(score), float(thr)


def rejection_response(
    model_loader: ModelLoader,
    anomaly_score: float,
    anomaly_threshold: float,
) -> ForgeryAnalysisResponse:
    return ForgeryAnalysisResponse(
        is_forgery=True,
        is_not_signature=True,
        rejection_reason="input_not_a_signature",
        similarity_score=0.0,
        threshold=model_loader.verification_threshold,
        anomaly_score=anomaly_score,
        anomaly_threshold=anomaly_threshold,
    )


def verify_embeddings(
    model_loader: ModelLoader,
    reference_embedding: torch.Tensor,
    candidate_embedding: torch.Tensor,
) -> ForgeryAnalysisResponse:
    is_not_sig, anomaly_score, anomaly_thr = check_candidate_anomaly(
        model_loader, candidate_embedding
    )
    if is_not_sig and anomaly_thr is not None:
        return rejection_response(model_loader, anomaly_score, anomaly_thr)

    similarity = float(
        F.cosine_similarity(reference_embedding, candidate_embedding, dim=1)
    )
    thr = model_loader.verification_threshold
    return ForgeryAnalysisResponse(
        is_forgery=similarity < thr,
        similarity_score=similarity,
        threshold=thr,
        is_not_signature=False,
        anomaly_score=anomaly_score if anomaly_thr is not None else None,
        anomaly_threshold=anomaly_thr,
    )
