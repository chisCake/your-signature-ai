"""
Роутер для анализа подделки по ID оригинальной и поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging
import json

from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.preprocessing import v1_preprocess_signature_data

# Импортируем функции для dependency injection
def get_supabase_client() -> SupabaseClient:
    # Импортируем глобальные экземпляры из main.py
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from main import get_supabase_client as main_get_supabase_client
    return main_get_supabase_client()

def get_model_loader() -> ModelLoader:
    # Импортируем глобальные экземпляры из main.py
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from main import get_model_loader as main_get_model_loader
    return main_get_model_loader()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forgery-by-id", tags=["forgery-analysis"])

class ForgeryByIdRequest(BaseModel):
    """Запрос для анализа подделки по ID"""
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
    request: Request,
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """
    Анализ подделки по ID оригинальной и поддельной подписи
    
    Args:
        request: FastAPI Request объект
        supabase_client: Клиент Supabase
        model_loader: Загрузчик модели
    
    Returns:
        Результат анализа подделки
    """
    try:
        logger.info("=== FORGERY BY ID REQUEST START ===")
        
        # Получаем сырые данные запроса для отладки
        body = await request.body()
        logger.info(f"Raw request body length: {len(body)}")
        logger.info(f"Raw request body: {body}")
        
        # Парсим JSON
        try:
            request_data = json.loads(body)
            logger.info(f"Parsed request data: {request_data}")
            logger.info(f"Request data type: {type(request_data)}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON")
        
        # Валидируем данные
        if not isinstance(request_data, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
        
        original_id = request_data.get('original_id')
        forgery_id = request_data.get('forgery_id')
        
        logger.info(f"Extracted IDs: original_id={original_id}, forgery_id={forgery_id}")
        
        # Проверяем, что ID не пустые
        if not original_id or not forgery_id:
            raise HTTPException(status_code=400, detail="original_id and forgery_id are required")
        
        logger.info(f"Analyzing forgery by ID: original={original_id}, forgery={forgery_id}")
        
        # Получаем данные оригинальной подписи
        original_data = supabase_client.get_signature_data(original_id)
        if not original_data:
            raise HTTPException(status_code=404, detail=f"Original signature {original_id} not found")
        
        # Получаем данные поддельной подписи
        forgery_data = supabase_client.get_signature_data(forgery_id)
        if not forgery_data:
            raise HTTPException(status_code=404, detail=f"Forgery signature {forgery_id} not found")
        
        # Преобразуем данные в формат для модели
        logger.info(f"Original data length: {len(original_data)}")
        logger.info(f"Forgery data length: {len(forgery_data)}")
        
        original_features = v1_preprocess_signature_data(original_data)
        forgery_features = v1_preprocess_signature_data(forgery_data)
        
        logger.info(f"Original features shape: {original_features.shape}")
        logger.info(f"Forgery features shape: {forgery_features.shape}")
        
        # Преобразуем в тензоры PyTorch
        import torch
        original_tensor = torch.from_numpy(original_features).float().unsqueeze(0)  # Добавляем batch dimension
        forgery_tensor = torch.from_numpy(forgery_features).float().unsqueeze(0)   # Добавляем batch dimension
        
        logger.info(f"Original tensor shape: {original_tensor.shape}")
        logger.info(f"Forgery tensor shape: {forgery_tensor.shape}")
        
        # Получаем эмбеддинги
        original_embedding = model_loader.encode_signature(original_tensor)
        forgery_embedding = model_loader.encode_signature(forgery_tensor)
        
        logger.info(f"Original embedding shape: {original_embedding.shape}")
        logger.info(f"Forgery embedding shape: {forgery_embedding.shape}")
        
        # Вычисляем косинусное сходство
        import torch.nn.functional as F
        similarity_score = float(F.cosine_similarity(original_embedding, forgery_embedding, dim=1))
        
        # Определяем порог для подделки (можно настроить)
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
        logger.info(f"Returning result: {result}")
        
        return result
        
    except HTTPException as e:
        logger.error(f"=== FORGERY BY ID HTTP ERROR ===")
        logger.error(f"HTTP Exception: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"=== FORGERY BY ID GENERAL ERROR ===")
        logger.error(f"Error analyzing forgery by ID: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return ForgeryAnalysisResponse(
            is_forgery=False,
            similarity_score=0.0,
            threshold=0.7,
            original_id=original_id if 'original_id' in locals() else "unknown",
            forgery_id=forgery_id if 'forgery_id' in locals() else "unknown",
            error=f"Analysis failed: {str(e)}"
        )
