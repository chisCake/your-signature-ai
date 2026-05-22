"""
Роутер для анализа подделки по ID оригинальной и поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import torch
import torch.nn.functional as F
import numpy as np 

# --- Импорт локальных компонентов проекта ---
# Классы и функции из utils/
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.preprocessing import to_numpy_points
from utils.feature_runtime import build_model_features
from utils.model_manager import SLOT_CURRENT

# --- Импорт функций-зависимостей из dependencies.py ---
# Это устраняет циклический импорт, так как роутер импортирует только функции,
# которые определены в отдельном модуле зависимостей.
from dependencies import get_supabase_client, get_model_loader


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forgery-by-id", tags=["forgery-analysis"])

class ForgeryByIdRequest(BaseModel):
    """Схема запроса для анализа подделки по ID"""
    original_id: str
    forgery_id: str

class ForgeryAnalysisResponse(BaseModel):
    """Ответ с результатом анализа подделки"""
    is_forgery: bool
    similarity_score: float
    threshold: float
    error: Optional[str] = None

@router.post("/", response_model=ForgeryAnalysisResponse)
async def analyze_forgery_by_id(
    request_body: ForgeryByIdRequest,
    # Используем импортированные функции напрямую
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """
    Анализ подделки по ID оригинальной и поддельной подписи
    
    Args:
        request_body: Валидированное тело запроса
        supabase_client: Клиент Supabase
        model_loader: Загрузчик модели
    
    Returns:
        Результат анализа подделки
    """
    original_id = request_body.original_id
    forgery_id = request_body.forgery_id

    try:
        logger.info("=== FORGERY BY ID REQUEST START ===")
        logger.info(f"Analyzing forgery by ID: original={original_id}, forgery={forgery_id}")

        # --- Шаг 1: Получение данных из Supabase ---
        logger.info("Step 1: Getting signature data from Supabase")
        original_data = supabase_client.get_signature_data(original_id, "genuine")
        if original_data is None:
            raise HTTPException(status_code=404, detail=f"Original signature {original_id} not found in genuine signatures")
        logger.info(f"Original data retrieved, length: {len(original_data)}")

        forgery_data = supabase_client.get_signature_data(forgery_id, "forged")
        if forgery_data is None:
            raise HTTPException(status_code=404, detail=f"Forgery signature {forgery_id} not found in forged signatures")
        logger.info(f"Forgery data retrieved, length: {len(forgery_data)}")

        # --- Шаг 2: Препроцессинг и подготовка тензоров ---
        logger.info("Step 2: Feature pipeline from active bundle")
        pipeline = model_loader.feature_pipeline
        threshold = model_loader.verification_threshold
        bundle_dir = SLOT_CURRENT

        original_features = build_model_features(
            to_numpy_points(original_data), pipeline, bundle_dir
        )
        forgery_features = build_model_features(
            to_numpy_points(forgery_data), pipeline, bundle_dir
        )
        logger.info(f"Preprocessing completed. Original features shape: {original_features.shape}, Forgery features shape: {forgery_features.shape}")
        
        original_tensor = torch.from_numpy(original_features).float().unsqueeze(0)
        forgery_tensor = torch.from_numpy(forgery_features).float().unsqueeze(0)
        logger.info(f"Tensors created. Original tensor shape: {original_tensor.shape}, Forgery tensor shape: {forgery_tensor.shape}")

        # --- Шаг 3: Получение эмбеддингов и анализ ---
        logger.info("Step 3: Getting embeddings from model")
        try:
            original_embedding = model_loader.encode_signature(original_tensor)
            logger.info(f"Original embedding generated, shape: {original_embedding.shape}")
            
            forgery_embedding = model_loader.encode_signature(forgery_tensor)
            logger.info(f"Forgery embedding generated, shape: {forgery_embedding.shape}")
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")

        logger.info("Step 4: Calculating similarity")
        similarity_score = float(F.cosine_similarity(original_embedding, forgery_embedding, dim=1))

        is_forgery = similarity_score < threshold

        logger.info(f"Analysis completed: similarity={similarity_score:.4f}, is_forgery={is_forgery}")

        result = ForgeryAnalysisResponse(
            is_forgery=is_forgery,
            similarity_score=similarity_score,
            threshold=threshold
        )

        logger.info(f"=== FORGERY BY ID REQUEST SUCCESS ===")
        return result

    except HTTPException:
        logger.error(f"=== FORGERY BY ID HTTP ERROR ===")
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