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
from utils.preprocessing import v1_preprocess_signature_data

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
        original_data = supabase_client.get_signature_data(original_id, "genuine")
        if original_data is None:
            raise HTTPException(status_code=404, detail=f"Original signature {original_id} not found in genuine signatures")

        forgery_data = supabase_client.get_signature_data(forgery_id, "forged")
        if forgery_data is None:
            raise HTTPException(status_code=404, detail=f"Forgery signature {forgery_id} not found in forged signatures")

        # --- Шаг 2: Препроцессинг и подготовка тензоров ---
        original_features = v1_preprocess_signature_data(original_data)
        forgery_features = v1_preprocess_signature_data(forgery_data)
        
        original_tensor = torch.from_numpy(original_features).float().unsqueeze(0)
        forgery_tensor = torch.from_numpy(forgery_features).float().unsqueeze(0)

        # --- Шаг 3: Получение эмбеддингов и анализ ---
        original_embedding = model_loader.encode_signature(original_tensor)
        forgery_embedding = model_loader.encode_signature(forgery_tensor)

        similarity_score = float(F.cosine_similarity(original_embedding, forgery_embedding, dim=1))

        threshold = 0.7 
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
        
        return ForgeryAnalysisResponse(
            is_forgery=False,
            similarity_score=0.0,
            threshold=0.7,
            error=f"Analysis failed: {type(e).__name__}: {str(e)}"
        )