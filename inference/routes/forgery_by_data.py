"""
Роутер для анализа подделки по ID оригинальной подписи и данным поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Union
import logging
import torch

from dependencies import get_supabase_client, get_model_loader
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.preprocessing import parse_csv_signature_data, to_numpy_points
from utils.feature_runtime import build_model_features
from utils.model_manager import SLOT_CURRENT
from utils.forgery_schemas import ForgeryAnalysisResponse
from utils.forgery_analysis import verify_embeddings


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forgery-by-data", tags=["forgery-analysis"])


class ForgeryByDataRequest(BaseModel):
    """Схема запроса для анализа подделки по данным."""

    original_id: str
    forgery_data: Union[
        List[List[float]], str
    ]  # CSV строка или список списков [t,x,y,p]


@router.post("/", response_model=ForgeryAnalysisResponse)
async def analyze_forgery_by_data(
    request_body: ForgeryByDataRequest,
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader),
):
    original_id = request_body.original_id

    try:
        logger.info("=== FORGERY BY DATA REQUEST START ===")
        logger.info(f"Analyzing forgery by data: original={original_id}")

        original_data = supabase_client.get_signature_data(original_id, "genuine")
        if not original_data:
            raise HTTPException(
                status_code=404,
                detail=f"Original signature {original_id} not found in genuine signatures",
            )

        if isinstance(request_body.forgery_data, str):
            forgery_data = parse_csv_signature_data(request_body.forgery_data)
        else:
            forgery_data = request_body.forgery_data

        if forgery_data is None or len(forgery_data) == 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid forgery data provided or failed to parse",
            )

        pipeline = model_loader.feature_pipeline
        bundle_dir = SLOT_CURRENT

        original_features = build_model_features(
            to_numpy_points(original_data), pipeline, bundle_dir
        )
        forgery_features = build_model_features(
            to_numpy_points(forgery_data), pipeline, bundle_dir
        )

        original_tensor = torch.from_numpy(original_features).float().unsqueeze(0)
        forgery_tensor = torch.from_numpy(forgery_features).float().unsqueeze(0)

        original_embedding = model_loader.encode_signature(original_tensor)
        forgery_embedding = model_loader.encode_signature(forgery_tensor)

        result = verify_embeddings(
            model_loader, original_embedding, forgery_embedding
        )

        logger.info(
            f"Analysis completed: similarity={result.similarity_score:.4f}, "
            f"is_forgery={result.is_forgery}, is_not_signature={result.is_not_signature}"
        )
        logger.info("=== FORGERY BY DATA REQUEST SUCCESS ===")
        return result

    except HTTPException:
        logger.error("=== FORGERY BY DATA HTTP ERROR ===")
        raise
    except Exception as e:
        logger.error(f"=== FORGERY BY DATA GENERAL ERROR ===")
        logger.error(f"Error analyzing forgery by data: {str(e)}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")

        err_threshold = (
            model_loader.verification_threshold
            if model_loader and hasattr(model_loader, "verification_threshold")
            else 0.0
        )
        return ForgeryAnalysisResponse(
            is_forgery=False,
            similarity_score=0.0,
            threshold=err_threshold,
            error=f"Analysis failed: {type(e).__name__}: {str(e)}",
        )
