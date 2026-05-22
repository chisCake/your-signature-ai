"""
Public model info and bundle artifacts from models/current/.
"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from dependencies import get_model_loader, get_model_manager
from utils.model_manager import SLOT_CURRENT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/model", tags=["model"])


def _require_current_dir():
    if not (SLOT_CURRENT / "manifest.json").exists():
        raise HTTPException(status_code=404, detail="No active model bundle on disk")
    return SLOT_CURRENT


@router.get("/", response_class=PlainTextResponse)
async def get_model_source():
    bundle_dir = _require_current_dir()
    path = bundle_dir / "encoder.py"
    if not path.exists():
        raise HTTPException(status_code=404, detail="encoder.py not found")
    return path.read_text(encoding="utf-8")


@router.get("/source", response_class=PlainTextResponse)
async def get_encoder_source():
    return await get_model_source()


@router.get("/features", response_class=PlainTextResponse)
async def get_features_source():
    bundle_dir = _require_current_dir()
    path = bundle_dir / "features.py"
    if not path.exists():
        raise HTTPException(status_code=404, detail="features.py not found")
    return path.read_text(encoding="utf-8")


@router.get("/info")
async def get_model_info(model_loader=Depends(get_model_loader)):
    try:
        return model_loader.get_model_info()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/artifacts")
async def get_artifacts():
    bundle_dir = _require_current_dir()
    with open(bundle_dir / "manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)

    plots_dir = bundle_dir / "plots"
    plots = []
    if plots_dir.exists():
        for p in sorted(plots_dir.glob("*.png")):
            plots.append(
                {
                    "file": p.name,
                    "title": p.stem.replace("_", " "),
                    "group": _plot_group(p.name),
                }
            )

    return {
        "manifest": manifest,
        "training_summary": manifest.get("training_summary"),
        "feature_pipeline": manifest.get("feature_pipeline"),
        "plots": plots,
    }


def _plot_group(filename: str) -> str:
    if "test" in filename:
        return "test"
    if "val" in filename:
        return "validation"
    if "eer" in filename or "auc" in filename:
        return "training_curves"
    return "other"


@router.get("/artifacts/plots/{filename}")
async def get_plot_file(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    bundle_dir = _require_current_dir()
    path = bundle_dir / "plots" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Plot not found")
    return FileResponse(path, media_type="image/png")


@router.get("/available")
async def get_available_models(model_manager=Depends(get_model_manager)):
    info = model_manager.get_model_info()
    return {
        "available_bundles": info.get("available_bundles", []),
        "active_model": info.get("active_model"),
    }
