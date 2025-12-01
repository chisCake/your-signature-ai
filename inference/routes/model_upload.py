"""
Роутер для загрузки и управления моделями через hotswap
"""

import os
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional
from dependencies import get_model_manager
from utils.model_manager import SwapStrategy

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/model", tags=["model-management"])


@router.post("/upload")
async def upload_model(
    model_name: str = Form(...),
    pt_file: UploadFile = File(...),
    py_file: UploadFile = File(...),
    swap_strategy: str = Form("zero_downtime"),
    model_manager=Depends(get_model_manager),
):
    """
    Загрузка новой модели с поддержкой hotswap

    Args:
        model_name: Имя модели (без расширения)
        pt_file: Файл с весами модели (.pt)
        py_file: Файл с кодом модели (.py)
        swap_strategy: Стратегия замены ("zero_downtime" или "sequential")
    """
    try:
        # Валидация имени модели
        if not model_name or not model_name.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(
                status_code=400,
                detail="Model name must contain only alphanumeric characters, underscores, and hyphens",
            )

        # Валидация файлов
        if not pt_file.filename.endswith(".pt"):
            raise HTTPException(
                status_code=400, detail="PT file must have .pt extension"
            )

        if not py_file.filename.endswith(".py"):
            raise HTTPException(
                status_code=400, detail="Python file must have .py extension"
            )

        # Валидация стратегии
        try:
            strategy = SwapStrategy(swap_strategy)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid swap strategy. Must be 'zero_downtime' or 'sequential'",
            )

        # Читаем содержимое файлов
        pt_content = await pt_file.read()
        py_content = await py_file.read()

        if len(pt_content) == 0:
            raise HTTPException(status_code=400, detail="PT file is empty")
        if len(py_content) == 0:
            raise HTTPException(status_code=400, detail="Python file is empty")

        logger.info(f"Uploading model {model_name} with strategy {swap_strategy}")

        # Загружаем модель через менеджер
        result = model_manager.upload_model(
            model_name=model_name,
            pt_content=pt_content,
            py_content=py_content,
            swap_strategy=strategy,
        )

        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload model: {e}", exc_info=True)
        # Форматируем сообщение об ошибке для пользователя
        error_msg = str(e)
        if (
            "size mismatch" in error_msg
            or "Error(s) in loading state_dict" in error_msg
        ):
            user_msg = (
                "Несоответствие архитектуры модели: файл весов (.pt) не совместим с кодом модели (.py). "
                "Убедитесь, что загружаете правильную пару файлов."
            )
        elif "SignatureEncoder" in error_msg and (
            "has no attribute" in error_msg or "not defined" in error_msg
        ):
            user_msg = "Ошибка в коде модели: класс SignatureEncoder в .py файле имеет неверную структуру."
        elif "No module named" in error_msg or "ModuleNotFoundError" in error_msg:
            user_msg = "Отсутствует зависимость: код модели требует модуль, который не установлен."
        elif (
            "Weights only load failed" in error_msg or "Unsupported global" in error_msg
        ):
            user_msg = (
                "Ошибка загрузки модели: файл содержит кастомные классы. "
                "Проверьте, что модель сохранена корректно."
            )
        else:
            user_msg = f"Ошибка загрузки модели: {error_msg}"

        raise HTTPException(status_code=500, detail=user_msg)


@router.get("/status")
async def get_model_status(model_manager=Depends(get_model_manager)):
    """Получение статуса всех моделей"""
    try:
        info = model_manager.get_model_info()
        return JSONResponse(content=info)
    except Exception as e:
        logger.error(f"Failed to get model status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get model status: {str(e)}"
        )


@router.post("/swap")
async def swap_model(
    model_name: str = Form(...),
    swap_strategy: str = Form("zero_downtime"),
    model_manager=Depends(get_model_manager),
):
    """
    Переключение на существующую модель с hotswap

    Args:
        model_name: Имя модели для активации
        swap_strategy: Стратегия замены
    """
    try:
        # Валидация стратегии
        try:
            strategy = SwapStrategy(swap_strategy)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid swap strategy. Must be 'zero_downtime' or 'sequential'",
            )

        # Проверяем существование модели
        models_dir = Path("models")
        pt_path = models_dir / f"{model_name}.pt"
        py_path = models_dir / f"{model_name}.py"

        if not pt_path.exists() or not py_path.exists():
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

        # Выполняем hotswap
        result = model_manager._hotswap_model(model_name, strategy)

        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to swap model: {e}", exc_info=True)
        # Форматируем сообщение об ошибке для пользователя
        error_msg = str(e)
        if (
            "size mismatch" in error_msg
            or "Error(s) in loading state_dict" in error_msg
        ):
            user_msg = "Несоответствие архитектуры модели: файл весов (.pt) не совместим с кодом модели (.py)."
        else:
            user_msg = f"Ошибка переключения модели: {error_msg}"

        raise HTTPException(status_code=500, detail=user_msg)


@router.delete("/{model_name}")
async def delete_model(model_name: str, model_manager=Depends(get_model_manager)):
    """Удаление модели"""
    try:
        result = model_manager.delete_model(model_name)
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete model: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")
