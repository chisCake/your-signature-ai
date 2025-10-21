"""
Роутер для анализа подделки по ID оригинальной и поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import torch
import torch.nn.functional as F
import numpy as np # Используется для работы с np.array, полученным из препроцессинга

# Импорт зависимостей из главного файла
# Предполагается, что main.py находится в родительской директории
try:
    from main import get_supabase_client, get_model_loader
    from utils.supabase_client import SupabaseClient
    from utils.model_loader import ModelLoader
    from utils.preprocessing import v1_preprocess_signature_data
except ImportError as e:
    # Запасной вариант для локального запуска или тестирования
    logging.error(f"Failed to import dependencies from main: {e}")
    # Здесь должны быть заглушки или явный сбой, если зависимости критичны
    SupabaseClient = type('SupabaseClient', (object,), {'get_signature_data': lambda self, id: None})
    ModelLoader = type('ModelLoader', (object,), {
        'encode_signature': lambda self, tensor: torch.rand(1, 128) # Заглушка
    })
    v1_preprocess_signature_data = lambda data: np.zeros((100, 3)) # Заглушка


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forgery-by-id", tags=["forgery-analysis"])

class ForgeryByIdRequest(BaseModel):
    """Схема запроса для анализа подделки по ID. 
    FastAPI автоматически использует эту модель для валидации JSON тела."""
    original_id: str
    forgery_id: str

class ForgeryAnalysisResponse(BaseModel):
    """Ответ с результатом анализа подделки"""
    is_forgery: bool
    similarity_score: float
    threshold: float
    original_id: str
    forgery_id: Optional[str] = None
    error: Optional[str] = None

@router.post("/", response_model=ForgeryAnalysisResponse)
async def analyze_forgery_by_id(
    request_body: ForgeryByIdRequest, # 👈 FastAPI автоматически валидирует тело запроса
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """
    Анализ подделки по ID оригинальной и поддельной подписи.
    
    Args:
        request_body: Валидированное тело запроса (original_id, forgery_id)
        supabase_client: Клиент Supabase, внедренный через Depends
        model_loader: Загрузчик модели, внедренный через Depends
    
    Returns:
        Результат анализа подделки
    """
    # Теперь мы получаем ID напрямую из валидированного объекта
    original_id = request_body.original_id
    forgery_id = request_body.forgery_id
    
    # Инициализация для обработки ошибок
    current_original_id = original_id
    current_forgery_id = forgery_id

    try:
        logger.info("=== FORGERY BY ID REQUEST START ===")
        logger.info(f"Analyzing forgery by ID: original={original_id}, forgery={forgery_id}")

        # --- Шаг 1: Получение данных из Supabase ---
        
        # Получаем данные оригинальной подписи
        original_data = supabase_client.get_signature_data(original_id)
        if not original_data:
            raise HTTPException(status_code=404, detail=f"Original signature {original_id} not found")

        # Получаем данные поддельной подписи
        forgery_data = supabase_client.get_signature_data(forgery_id)
        if not forgery_data:
            raise HTTPException(status_code=404, detail=f"Forgery signature {forgery_id} not found")

        # --- Шаг 2: Препроцессинг и подготовка тензоров ---
        
        original_features = v1_preprocess_signature_data(original_data)
        forgery_features = v1_preprocess_signature_data(forgery_data)
        
        # Преобразуем в тензоры PyTorch и добавляем batch dimension
        original_tensor = torch.from_numpy(original_features).float().unsqueeze(0)
        forgery_tensor = torch.from_numpy(forgery_features).float().unsqueeze(0)

        # --- Шаг 3: Получение эмбеддингов и анализ ---

        # Получаем эмбеддинги
        original_embedding = model_loader.encode_signature(original_tensor)
        forgery_embedding = model_loader.encode_signature(forgery_tensor)

        # Вычисляем косинусное сходство
        similarity_score = float(F.cosine_similarity(original_embedding, forgery_embedding, dim=1))

        # Определяем порог для подделки
        threshold = 0.7 

        # Определяем, является ли это подделкой
        is_forgery = similarity_score < threshold

        logger.info(f"Analysis completed: similarity={similarity_score:.4f}, is_forgery={is_forgery}")

        result = ForgeryAnalysisResponse(
            is_forgery=is_forgery,
            similarity_score=similarity_score,
            threshold=threshold,
            original_id=original_id,
            forgery_id=forgery_id
        )

        logger.info(f"=== FORGERY BY ID REQUEST SUCCESS ===")
        return result

    except HTTPException as e:
        logger.error(f"=== FORGERY BY ID HTTP ERROR ===")
        logger.error(f"HTTP Exception: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"=== FORGERY BY ID GENERAL ERROR ===")
        logger.error(f"Error analyzing forgery by ID: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Возвращаем структурированный ответ об ошибке
        return ForgeryAnalysisResponse(
            is_forgery=False,
            similarity_score=0.0,
            threshold=0.7,
            original_id=current_original_id,
            forgery_id=current_forgery_id,
            error=f"Analysis failed: {str(e)}"
        )
