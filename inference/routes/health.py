"""
Health check эндпоинты
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader

# Импортируем функции для dependency injection из dependencies.py
from dependencies import get_supabase_client, get_model_loader

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check(
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """Проверка состояния сервера"""
    try:
        # Получаем информацию о памяти (как в /memory)
        memory_info = model_loader.get_memory_info()
        model_info = model_loader.get_model_info()
        
        # Извлекаем название файла модели без расширения
        import os
        model_name = os.path.splitext(os.path.basename(model_loader.model_path))[0]
        
        status = {
            "ok": True,
            "supabase": supabase_client is not None,
            "memory_mb": memory_info.get("rss_mb", 0),
            "model": {
                "name": model_name,
                "device": model_info.get("device", "unknown")
            }
        }
        
        return JSONResponse(content=status)
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@router.get("/memory")
async def memory_status(
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """Мониторинг использования памяти"""
    try:
        memory_info = model_loader.get_memory_info()
        model_info = model_loader.get_model_info()
        
        status = {
            "memory": memory_info,
            "model": model_info,
            "timestamp": None  # Можно добавить текущее время
        }
        
        return JSONResponse(content=status)
        
    except Exception as e:
        logger.error(f"Memory status check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Memory status check failed: {str(e)}")


@router.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "Signature Inference Server",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "memory": "/memory",
            "forgery_by_id": "/forgery-by-id",
            "forgery_by_data": "/forgery-by-data",
            "docs": "/docs"
        }
    }
