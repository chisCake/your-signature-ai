"""
Роутер для работы с моделью
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from dependencies import get_model_loader
from model_config import get_active_model_config, get_available_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/model", tags=["model"])


@router.get("/", response_class=PlainTextResponse)
async def get_model_source():
    """
    Возвращает исходный код файла активной модели в виде plain text
    """
    try:
        # Получаем конфигурацию активной модели
        model_config = get_active_model_config()
        file_path = model_config["file_path"]
        
        # Проверяем существование файла
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404, 
                detail=f"Model file not found: {file_path}"
            )
        
        # Читаем содержимое файла
        with open(file_path, 'r', encoding='utf-8') as f:
            file_content = f.read()
        
        logger.info(f"Returned model source from {file_path}")
        return file_content
        
    except Exception as e:
        logger.error(f"Failed to read model source: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read model source: {str(e)}"
        )


@router.get("/info")
async def get_model_info(model_loader=Depends(get_model_loader)):
    """
    Возвращает информацию о загруженной модели
    """
    try:
        model_info = model_loader.get_model_info()
        
        # Добавляем информацию о конфигурации
        model_config = get_active_model_config()
        model_info.update({
            "config": model_config,
            "available_models": get_available_models()
        })
        
        return model_info
        
    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get model info: {str(e)}"
        )


@router.get("/available")
async def get_available_models_list():
    """
    Возвращает список доступных моделей
    """
    try:
        return {
            "available_models": get_available_models(),
            "active_model": get_active_model_config()
        }
    except Exception as e:
        logger.error(f"Failed to get available models: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get available models: {str(e)}"
        )
