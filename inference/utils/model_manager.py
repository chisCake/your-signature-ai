"""
Model manager: Blob zip registry + two unpacked slots (current/previous).
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
import threading
import time
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from utils.blob_client import BlobClient
from utils.bundle import (
    pytorch_smoke_test,
    sha256_bytes,
    unpack_zip_bytes,
    unpack_zip_file,
    validate_bundle_dir,
)
from utils.feature_runtime import clear_features_cache
from utils.model_loader import ModelLoader
from utils.models_registry import deactivate_all_models, upsert_model_record

logger = logging.getLogger(__name__)

SLOT_CURRENT = Path("models/current")
SLOT_PREVIOUS = Path("models/previous")
SLOT_CACHE = Path("models/_cache")
MAX_UNPACKED_SLOTS = 2


class SwapStrategy(Enum):
    ZERO_DOWNTIME = "zero_downtime"
    SEQUENTIAL = "sequential"


class ModelManager:
    def __init__(
        self,
        *,
        model_name: Optional[str] = None,
        blob_client: Optional[BlobClient] = None,
        environment: str = "development",
        supabase_client=None,
    ):
        self.lock = threading.RLock()
        self.blob_client = blob_client
        self.environment = environment
        self.supabase_client = supabase_client
        self.models_dir = Path("models")
        self.models_dir.mkdir(parents=True, exist_ok=True)
        SLOT_CACHE.mkdir(parents=True, exist_ok=True)

        self.available_bundles: List[str] = []
        self.blob_registry: Dict[str, Dict[str, Any]] = {}
        self.blob_synced_at: Optional[float] = None

        self.current_bundle_name: Optional[str] = None
        self.previous_bundle_name: Optional[str] = None
        self.active_loader: Optional[ModelLoader] = None

        self.refresh_blob_registry()
        target = model_name or os.getenv("MODEL_NAME", "temp-quick")
        self._startup_load(target)

    def refresh_blob_registry(self) -> None:
        combined: Dict[str, Dict[str, Any]] = {}
        if self.blob_client:
            cursor: Optional[str] = None
            while True:
                listing = self.blob_client.list(prefix="models/", cursor=cursor)
                for blob in listing.get("blobs", []):
                    pathname = blob.get("pathname", "")
                    if not pathname.endswith(".zip"):
                        continue
                    name = Path(pathname).stem
                    combined[name] = {
                        "pathname": pathname,
                        "download_url": blob.get("downloadUrl") or blob.get("url"),
                        "size": blob.get("size", 0),
                    }
                if not listing.get("hasMore") or not listing.get("cursor"):
                    break
                cursor = listing.get("cursor")
        else:
            for zp in self.models_dir.glob("*.zip"):
                combined[zp.stem] = {"pathname": str(zp), "local": True}

        self.blob_registry = combined
        self.available_bundles = sorted(combined.keys())
        self.blob_synced_at = time.time()
        logger.info("Blob registry: %s bundles", len(self.available_bundles))

    def _manifest_bundle_name(self, slot: Path) -> Optional[str]:
        manifest_path = slot / "manifest.json"
        if not manifest_path.exists():
            return None
        import json

        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("bundle_name")

    def _startup_load(self, model_name: str) -> None:
        current_name = self._manifest_bundle_name(SLOT_CURRENT)
        if current_name == model_name and (SLOT_CURRENT / "manifest.json").exists():
            logger.info("Fast startup: reusing models/current for %s", model_name)
            self._load_current_into_ram()
            return

        zip_path = self._resolve_zip_path(model_name)
        if zip_path is None:
            logger.warning(
                "Bundle %s not found in Blob/local; server starts without active model",
                model_name,
            )
            return

        self._rotate_slots_for_new_current(model_name)
        self._unpack_zip_to_slot(zip_path, SLOT_CURRENT)
        self._load_current_into_ram()

    def _resolve_zip_path(self, bundle_name: str) -> Optional[Path]:
        entry = self.blob_registry.get(bundle_name)
        if entry and entry.get("local"):
            local = Path(entry["pathname"])
            if local.exists():
                return local
        local_zip = self.models_dir / f"{bundle_name}.zip"
        if local_zip.exists():
            return local_zip
        if entry and self.blob_client and entry.get("pathname"):
            cache_zip = SLOT_CACHE / f"{bundle_name}.zip"
            self.blob_client.ensure_local_copy(
                entry["pathname"],
                cache_zip,
                download_url=entry.get("download_url"),
            )
            if cache_zip.exists():
                return cache_zip
        return None

    def _unpack_zip_to_slot(self, zip_path: Path, slot: Path) -> None:
        if slot.exists():
            shutil.rmtree(slot)
        slot.mkdir(parents=True, exist_ok=True)
        unpack_zip_file(zip_path, slot)

    def _rotate_slots_for_new_current(self, new_name: str) -> None:
        if SLOT_PREVIOUS.exists():
            shutil.rmtree(SLOT_PREVIOUS)
        if SLOT_CURRENT.exists() and any(SLOT_CURRENT.iterdir()):
            if SLOT_PREVIOUS.exists():
                shutil.rmtree(SLOT_PREVIOUS)
            shutil.move(str(SLOT_CURRENT), str(SLOT_PREVIOUS))
            self.previous_bundle_name = self.current_bundle_name
        self.current_bundle_name = None

    def _load_current_into_ram(self) -> None:
        with self.lock:
            if not (SLOT_CURRENT / "manifest.json").exists():
                raise RuntimeError("No bundle in models/current/")
            validate_bundle_dir(SLOT_CURRENT)
            if self.active_loader is not None:
                self.active_loader.unload_model()
                self.active_loader = None
            clear_features_cache()
            self.active_loader = ModelLoader(SLOT_CURRENT)
            self.current_bundle_name = self.active_loader.bundle_name
            logger.info("Active model in RAM: %s", self.current_bundle_name)

    def get_active_model(self) -> Optional[ModelLoader]:
        with self.lock:
            return self.active_loader

    def get_current_bundle_dir(self) -> Path:
        return SLOT_CURRENT

    def upload_bundle_zip(
        self,
        model_name: str,
        zip_bytes: bytes,
        *,
        activate: bool = False,
        swap_strategy: SwapStrategy = SwapStrategy.ZERO_DOWNTIME,
    ) -> Dict[str, Any]:
        completed: List[str] = []
        try:
            completed.append("received")
            with tempfile.TemporaryDirectory() as tmp:
                staging = Path(tmp)
                unpack_zip_bytes(zip_bytes, staging)
                manifest = validate_bundle_dir(staging)
                completed.append("unpack")
                completed.append("manifest")
                if manifest.get("bundle_name") and manifest["bundle_name"] != model_name:
                    logger.warning(
                        "manifest bundle_name=%s differs from model_name=%s",
                        manifest["bundle_name"],
                        model_name,
                    )
                pytorch_smoke_test(staging, manifest)
                completed.append("pytorch_smoke")

            file_hash = sha256_bytes(zip_bytes)
            storage: Dict[str, Any] = {"type": "local"}

            if self.blob_client:
                pathname = f"models/{model_name}.zip"
                result = self.blob_client.upload_bytes(
                    pathname, zip_bytes, content_type="application/zip"
                )
                storage = {
                    "type": "blob",
                    "bundle_blob_path": result.get("pathname", pathname),
                    "download_url": result.get("downloadUrl") or result.get("url"),
                }
                completed.append("blob")
            else:
                local_zip = self.models_dir / f"{model_name}.zip"
                local_zip.write_bytes(zip_bytes)
                storage["bundle_path"] = str(local_zip)
                completed.append("blob")

            self.refresh_blob_registry()

            metadata_summary = {
                "bundle_name": model_name,
                "verification_threshold": manifest["verification"]["threshold"],
                "in_features": manifest["in_features"],
                "feature_pipeline": manifest["feature_pipeline"],
                "blob_path": storage.get("bundle_blob_path", f"models/{model_name}.zip"),
                "bundle_sha256": file_hash,
            }

            upsert_model_record(
                self.supabase_client,
                bundle_name=model_name,
                file_hash=file_hash,
                metadata=metadata_summary,
                is_active=False,
            )
            completed.append("database")

            activated = False
            if activate:
                self.activate_model(model_name, swap_strategy=swap_strategy)
                activated = True
                completed.append("activate")

            return {
                "success": True,
                "activated": activated,
                "model_name": model_name,
                "completed_stages": completed,
                "storage": storage,
                "metadata_summary": metadata_summary,
            }
        except Exception as e:
            return {
                "success": False,
                "activated": False,
                "model_name": model_name,
                "failed_stage": completed[-1] if completed else "received",
                "message": str(e),
                "completed_stages": completed,
            }

    def activate_model(
        self, model_name: str, swap_strategy: SwapStrategy = SwapStrategy.ZERO_DOWNTIME
    ) -> Dict[str, Any]:
        del swap_strategy  # slot rotation is always sequential on disk

        with self.lock:
            if model_name == self.current_bundle_name and self.active_loader:
                return {"success": True, "message": "Already active", "model_name": model_name}

            if (
                model_name == self.previous_bundle_name
                and (SLOT_PREVIOUS / "manifest.json").exists()
            ):
                return self.rollback()

            zip_path = self._resolve_zip_path(model_name)
            if zip_path is None:
                raise FileNotFoundError(f"Bundle zip not found: {model_name}")

            self._rotate_slots_for_new_current(model_name)
            self._unpack_zip_to_slot(zip_path, SLOT_CURRENT)

            if swap_strategy == SwapStrategy.SEQUENTIAL and self.active_loader:
                self.active_loader.unload_model()

            self._load_current_into_ram()

            manifest = validate_bundle_dir(SLOT_CURRENT)
            upsert_model_record(
                self.supabase_client,
                bundle_name=model_name,
                file_hash=manifest.get("bundle_sha256", ""),
                metadata={
                    "bundle_name": model_name,
                    "verification_threshold": manifest["verification"]["threshold"],
                    "in_features": manifest["in_features"],
                },
                is_active=True,
            )

            return {
                "success": True,
                "model_name": model_name,
                "current": self.current_bundle_name,
                "previous": self.previous_bundle_name,
            }

    def rollback(self) -> Dict[str, Any]:
        with self.lock:
            if not (SLOT_PREVIOUS / "manifest.json").exists():
                raise RuntimeError("No previous bundle available for rollback")

            tmp = self.models_dir / "_swap_tmp"
            if tmp.exists():
                shutil.rmtree(tmp)

            shutil.move(str(SLOT_CURRENT), str(tmp))
            shutil.move(str(SLOT_PREVIOUS), str(SLOT_CURRENT))
            shutil.move(str(tmp), str(SLOT_PREVIOUS))

            self.current_bundle_name, self.previous_bundle_name = (
                self.previous_bundle_name,
                self.current_bundle_name,
            )

            self._load_current_into_ram()

            if self.current_bundle_name:
                manifest = validate_bundle_dir(SLOT_CURRENT)
                upsert_model_record(
                    self.supabase_client,
                    bundle_name=self.current_bundle_name,
                    file_hash=manifest.get("bundle_sha256", ""),
                    metadata={
                        "bundle_name": self.current_bundle_name,
                        "verification_threshold": manifest["verification"]["threshold"],
                    },
                    is_active=True,
                )

            return {
                "success": True,
                "model_name": self.current_bundle_name,
                "previous": self.previous_bundle_name,
                "rolled_back": True,
            }

    def get_model_info(self) -> Dict[str, Any]:
        with self.lock:
            prev_ready = (SLOT_PREVIOUS / "manifest.json").exists()
            return {
                "active_model": self.current_bundle_name,
                "current": {
                    "bundle_name": self.current_bundle_name,
                    "loaded": self.active_loader is not None,
                },
                "previous": {
                    "bundle_name": self.previous_bundle_name,
                    "ready_for_rollback": prev_ready,
                },
                "available_bundles": self.available_bundles,
                "blob_synced_at": self.blob_synced_at,
                "loader_info": (
                    self.active_loader.get_model_info() if self.active_loader else None
                ),
            }

    def delete_model(self, model_name: str) -> Dict[str, Any]:
        with self.lock:
            if model_name == self.current_bundle_name:
                raise ValueError("Cannot delete active model; activate another first")
            if self.blob_client:
                pathname = f"models/{model_name}.zip"
                self.blob_client.delete([pathname])
            local_zip = self.models_dir / f"{model_name}.zip"
            if local_zip.exists():
                local_zip.unlink()
            self.refresh_blob_registry()
            return {"success": True, "deleted": model_name}
