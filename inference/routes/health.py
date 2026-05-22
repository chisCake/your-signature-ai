"""
Health check endpoints (model optional).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from dependencies import get_model_manager, get_supabase_client
from utils.supabase_client import SupabaseClient
from utils.model_manager import ModelManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check(
    supabase_client: SupabaseClient = Depends(get_supabase_client),
    model_manager: ModelManager = Depends(get_model_manager),
):
    try:
        loader = model_manager.get_active_model()
        model_block = None
        if loader:
            model_info = loader.get_model_info()
            memory_info = loader.get_memory_info()
            model_block = {
                "name": loader.bundle_name,
                "device": model_info.get("device", "unknown"),
                "loaded": True,
                "memory_mb": memory_info.get("rss_mb", 0),
            }

        status = {
            "ok": True,
            "supabase": supabase_client is not None,
            "model": model_block,
        }
        return JSONResponse(content=status)
    except Exception as e:
        logger.error("Health check failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory")
async def memory_status(model_manager: ModelManager = Depends(get_model_manager)):
    loader = model_manager.get_active_model()
    if not loader:
        return JSONResponse(content={"model": None, "memory": {}})
    return JSONResponse(
        content={
            "memory": loader.get_memory_info(),
            "model": loader.get_model_info(),
        }
    )


@router.get("/")
async def root():
    return {
        "message": "Signature Inference Server",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "forgery_by_id": "/forgery-by-id",
            "forgery_by_data": "/forgery-by-data",
            "model": "/model",
            "docs": "/docs",
        },
    }
