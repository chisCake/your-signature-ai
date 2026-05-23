"""
Роутер для анализа подделки по ID оригинальной и поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import logging
import torch

from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.preprocessing import to_numpy_points
from utils.feature_runtime import build_model_features
from utils.model_manager import SLOT_CURRENT
from dependencies import get_supabase_client, get_model_loader
from utils.forgery_schemas import ForgeryAnalysisResponse
from utils.forgery_analysis import verify_embeddings


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forgery-by-id", tags=["forgery-analysis"])


class ForgeryByIdRequest(BaseModel):
    original_id: str
    forgery_id: str


@router.post("/", response_model=ForgeryAnalysisResponse)
async def analyze_forgery_by_id(
    request_body: ForgeryByIdRequest,
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader),
):
    original_id = request_body.original_id
    forgery_id = request_body.forgery_id

    try:
        logger.info("=== FORGERY BY ID REQUEST START ===")
        logger.info(
            f"Analyzing forgery by ID: original={original_id}, forgery={forgery_id}"
        )

        original_data = supabase_client.get_signature_data(original_id, "genuine")
        if original_data is None:
            raise HTTPException(
                status_code=404,
                detail=f"Original signature {original_id} not found in genuine signatures",
            )

        forgery_data = supabase_client.get_signature_data(forgery_id, "forged")
        if forgery_data is None:
            raise HTTPException(
                status_code=404,
                detail=f"Forgery signature {forgery_id} not found in forged signatures",
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
        logger.info("=== FORGERY BY ID REQUEST SUCCESS ===")
        return result

    except HTTPException:
        logger.error("=== FORGERY BY ID HTTP ERROR ===")
        raise
    except Exception as e:
        logger.error(f"=== FORGERY BY ID GENERAL ERROR ===")
        logger.error(f"Error analyzing forgery by ID: {str(e)}")
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
