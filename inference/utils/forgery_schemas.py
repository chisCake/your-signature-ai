"""Shared Pydantic schemas for forgery analysis routes."""

from typing import Optional

from pydantic import BaseModel


class ForgeryAnalysisResponse(BaseModel):
    is_forgery: bool
    similarity_score: float
    threshold: float
    is_not_signature: bool = False
    rejection_reason: Optional[str] = None
    anomaly_score: Optional[float] = None
    anomaly_threshold: Optional[float] = None
    error: Optional[str] = None
