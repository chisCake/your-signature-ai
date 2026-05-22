"""
Model bundle upload, activate, rollback.
"""

import logging
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from dependencies import get_model_manager
from utils.model_manager import SwapStrategy

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/model", tags=["model-management"])


@router.post("/upload")
async def upload_model(
    model_name: str = Form(...),
    bundle_file: UploadFile = File(...),
    activate: bool = Form(False),
    swap_strategy: str = Form("zero_downtime"),
    model_manager=Depends(get_model_manager),
):
    try:
        if not model_name or not model_name.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(
                status_code=400,
                detail="Model name must be alphanumeric (with _ or -)",
            )
        if not bundle_file.filename or not bundle_file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="bundle_file must be a .zip")

        try:
            strategy = SwapStrategy(swap_strategy)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="swap_strategy must be zero_downtime or sequential",
            )

        zip_bytes = await bundle_file.read()
        if not zip_bytes:
            raise HTTPException(status_code=400, detail="Empty zip file")

        result = model_manager.upload_bundle_zip(
            model_name=model_name,
            zip_bytes=zip_bytes,
            activate=activate,
            swap_strategy=strategy,
        )
        status = 200 if result.get("success") else 422
        return JSONResponse(content=result, status_code=status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Upload failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activate")
async def activate_model(
    model_name: str = Form(...),
    swap_strategy: str = Form("zero_downtime"),
    model_manager=Depends(get_model_manager),
):
    try:
        strategy = SwapStrategy(swap_strategy)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid swap_strategy")

    try:
        result = model_manager.activate_model(model_name, swap_strategy=strategy)
        return JSONResponse(content=result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Activate failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rollback")
async def rollback_model(model_manager=Depends(get_model_manager)):
    try:
        result = model_manager.rollback()
        return JSONResponse(content=result)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Rollback failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_model_status(model_manager=Depends(get_model_manager)):
    try:
        return JSONResponse(content=model_manager.get_model_info())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/swap")
async def swap_model(
    model_name: str = Form(...),
    swap_strategy: str = Form("zero_downtime"),
    model_manager=Depends(get_model_manager),
):
    """Legacy alias for activate."""
    return await activate_model(model_name, swap_strategy, model_manager)


@router.delete("/{model_name}")
async def delete_model(model_name: str, model_manager=Depends(get_model_manager)):
    try:
        result = model_manager.delete_model(model_name)
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
