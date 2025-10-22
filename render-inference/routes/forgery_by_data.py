"""
Роутер для анализа подделки по ID оригинальной подписи и данным поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Union
import logging
import torch
import torch.nn.functional as F
import numpy as np 

# --- ИСПРАВЛЕННЫЙ ИМПОРТ ЗАВИСИМОСТЕЙ ---
# Импортируем функции зависимостей из dependencies.py
# Это устраняет проблему циклического импорта
from dependencies import get_supabase_client, get_model_loader
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.preprocessing import v1_preprocess_signature_data, parse_csv_signature_data


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forgery-by-data", tags=["forgery-analysis"])

class ForgeryByDataRequest(BaseModel):
    """Схема запроса для анализа подделки по данным."""
    original_id: str
    forgery_data: Union[List[List[float]], str]  # CSV строка или список списков [t,x,y,p]

class ForgeryAnalysisResponse(BaseModel):
    """Ответ с результатом анализа подделки"""
    is_forgery: bool
    similarity_score: float
    threshold: float
    error: Optional[str] = None

@router.post("/", response_model=ForgeryAnalysisResponse)
async def analyze_forgery_by_data(
    request_body: ForgeryByDataRequest, 
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """
    Анализ подделки по ID оригинальной подписи и данным поддельной подписи
    
    Args:
        request_body: Валидированное тело запроса
        supabase_client: Клиент Supabase
        model_loader: Загрузчик модели
    
    Returns:
        Результат анализа подделки
    """
    # Теперь мы получаем ID напрямую из валидированного объекта
    original_id = request_body.original_id

    try:
        logger.info("=== FORGERY BY DATA REQUEST START ===")
        logger.info(f"Analyzing forgery by data: original={original_id}")
        logger.info(f"Forgery data type: {type(request_body.forgery_data)}")

        # --- Шаг 1: Получение данных оригинальной подписи ---
        original_data = supabase_client.get_signature_data(original_id, "genuine")
        if not original_data:
            raise HTTPException(status_code=404, detail=f"Original signature {original_id} not found in genuine signatures")

        # --- Шаг 2: Обработка данных поддельной подписи ---
        forgery_data: List[List[float]]

        if isinstance(request_body.forgery_data, str):
            # Если это CSV строка, парсим её
            logger.info("Parsing CSV forgery data")
            forgery_data = parse_csv_signature_data(request_body.forgery_data)
        else:
            # Если это уже список списков, используем как есть
            logger.info("Using forgery data as list of lists")
            forgery_data = request_body.forgery_data

        if not forgery_data:
            raise HTTPException(status_code=400, detail="Invalid forgery data provided or failed to parse")

        # --- Шаг 3: Препроцессинг и подготовка тензоров ---
        original_features = v1_preprocess_signature_data(original_data)
        forgery_features = v1_preprocess_signature_data(forgery_data)

        # Преобразуем в тензоры PyTorch
        original_tensor = torch.from_numpy(original_features).float().unsqueeze(0)
        forgery_tensor = torch.from_numpy(forgery_features).float().unsqueeze(0)

        # --- Шаг 4: Получение эмбеддингов и анализ ---
        original_embedding = model_loader.encode_signature(original_tensor)
        forgery_embedding = model_loader.encode_signature(forgery_tensor)

        # Вычисляем косинусное сходство
        similarity_score = float(F.cosine_similarity(original_embedding, forgery_embedding, dim=1))

        # Определяем порог для подделки
        threshold = 0.75

        # Определяем, является ли это подделкой
        is_forgery = similarity_score < threshold

        logger.info(f"Analysis completed: similarity={similarity_score:.4f}, is_forgery={is_forgery}")

        result = ForgeryAnalysisResponse(
            is_forgery=is_forgery,
            similarity_score=similarity_score,
            threshold=threshold
        )

        logger.info(f"=== FORGERY BY DATA REQUEST SUCCESS ===")
        return result

    except HTTPException as e:
        logger.error(f"=== FORGERY BY DATA HTTP ERROR ===")
        logger.error(f"HTTP Exception: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"=== FORGERY BY DATA GENERAL ERROR ===")
        logger.error(f"Error analyzing forgery by data: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

        # Возвращаем структурированный ответ об ошибке
        return ForgeryAnalysisResponse(
            is_forgery=False,
            similarity_score=0.0,
            threshold=0.75,
            error=f"Analysis failed: {type(e).__name__}: {str(e)}"
        )