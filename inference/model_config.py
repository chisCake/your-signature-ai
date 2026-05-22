"""
Legacy config helpers — active bundle is models/current/.
"""

import os
from pathlib import Path

SLOT_CURRENT = Path("models/current")


def get_active_model_config() -> dict:
    return {
        "module": "bundle",
        "class_name": "SignatureEncoder",
        "file_path": str(SLOT_CURRENT / "encoder.py"),
        "checkpoint_path": str(SLOT_CURRENT / "weights.pt"),
        "bundle_dir": str(SLOT_CURRENT),
        "model_name": os.getenv("MODEL_NAME", "temp-quick"),
    }


def get_available_models() -> list:
    return []
