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
        status = {
            "status": "healthy",
            "supabase_connected": supabase_client is not None,
            "model_loaded": model_loader is not None and model_loader.is_model_loaded,
            "timestamp": None  # Можно добавить текущее время
        }
        
        # Проверка доступности модели
        if model_loader and model_loader.is_loaded():
            status["model_info"] = model_loader.get_model_info()
        
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


@router.post("/model/unload")
async def unload_model(
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """Выгрузка модели из памяти"""
    try:
        model_loader.unload_model()
        return JSONResponse(content={"message": "Model unloaded successfully"})
        
    except Exception as e:
        logger.error(f"Model unload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Model unload failed: {str(e)}")


@router.post("/model/load")
async def load_model(
    model_loader: ModelLoader = Depends(get_model_loader)
):
    """Принудительная загрузка модели в память"""
    try:
        if not model_loader.is_loaded():
            model_loader.load_model()
            return JSONResponse(content={"message": "Model loaded successfully"})
        else:
            return JSONResponse(content={"message": "Model already loaded"})
        
    except Exception as e:
        logger.error(f"Model load failed: {e}")
        raise HTTPException(status_code=500, detail=f"Model load failed: {str(e)}")


@router.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "Signature Inference Server",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "memory": "/memory",
            "model_unload": "/model/unload",
            "model_load": "/model/load",
            "forgery_by_id": "/forgery-by-id",
            "forgery_by_data": "/forgery-by-data",
            "docs": "/docs"
        }
    }
