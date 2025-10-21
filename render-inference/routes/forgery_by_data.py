"""
Роутер для анализа подделки по ID оригинальной подписи и данным поддельной подписи
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Union
import logging

from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.preprocessing import v1_preprocess_signature_data, parse_csv_signature_data

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

router = APIRouter(prefix="/forgery-by-data", tags=["forgery-analysis"])

class ForgeryByDataRequest(BaseModel):
    """Запрос для анализа подделки по данным"""
    original_id: str
    forgery_data: Union[List[List[float]], str]  # CSV строка или список списков [t,x,y,p]

class ForgeryAnalysisResponse(BaseModel):
    """Ответ с результатом анализа подделки"""
    is_forgery: bool
    similarity_score: float
    threshold: float
    original_id: str
    forgery_id: Optional[str] = None
    error: Optional[str] = None

@router.post("/", response_model=ForgeryAnalysisResponse)
async def analyze_forgery_by_data(
    request: ForgeryByDataRequest,
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """
    Анализ подделки по ID оригинальной подписи и данным поддельной подписи
    
    Args:
        request: Запрос с ID оригинальной подписи и данными поддельной подписи
        supabase_client: Клиент Supabase
        model_loader: Загрузчик модели
    
    Returns:
        Результат анализа подделки
    """
    try:
        logger.info("=== FORGERY BY DATA REQUEST START ===")
        logger.info(f"Analyzing forgery by data: original={request.original_id}")
        logger.info(f"Forgery data type: {type(request.forgery_data)}")
        
        # Получаем данные оригинальной подписи
        original_data = supabase_client.get_signature_data(request.original_id)
        if not original_data:
            raise HTTPException(status_code=404, detail=f"Original signature {request.original_id} not found")
        
        logger.info(f"Original data length: {len(original_data)}")
        
        # Обрабатываем данные поддельной подписи
        if isinstance(request.forgery_data, str):
            # Если это CSV строка, парсим её
            logger.info("Parsing CSV forgery data")
            forgery_data = parse_csv_signature_data(request.forgery_data)
        else:
            # Если это уже список списков, используем как есть
            logger.info("Using forgery data as list of lists")
            forgery_data = request.forgery_data
        
        if not forgery_data:
            raise HTTPException(status_code=400, detail="Invalid forgery data provided")
        
        logger.info(f"Forgery data length: {len(forgery_data)}")
        
        # Преобразуем данные в формат для модели
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
        threshold = 0.75
        
        # Определяем, является ли это подделкой
        is_forgery = similarity_score < threshold
        
        logger.info(f"Analysis completed: similarity={similarity_score:.4f}, is_forgery={is_forgery}")
        
        result = ForgeryAnalysisResponse(
            is_forgery=is_forgery,
            similarity_score=similarity_score,
            threshold=threshold,
            original_id=request.original_id
        )
        
        logger.info(f"=== FORGERY BY DATA REQUEST SUCCESS ===")
        logger.info(f"Returning result: {result}")
        
        return result
        
    except HTTPException as e:
        logger.error(f"=== FORGERY BY DATA HTTP ERROR ===")
        logger.error(f"HTTP Exception: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"=== FORGERY BY DATA GENERAL ERROR ===")
        logger.error(f"Error analyzing forgery by data: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return ForgeryAnalysisResponse(
            is_forgery=False,
            similarity_score=0.0,
            threshold=0.7,
            original_id=request.original_id,
            error=f"Analysis failed: {str(e)}"
        )
