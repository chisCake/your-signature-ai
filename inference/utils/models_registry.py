"""Supabase models table cache (service role)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def upsert_model_record(
    supabase_client,
    *,
    bundle_name: str,
    file_hash: str,
    metadata: Dict[str, Any],
    is_active: bool,
    description: Optional[str] = None,
) -> None:
    if supabase_client is None:
        logger.warning("Supabase client not available; skipping models upsert")
        return

    try:
        existing = (
            supabase_client.client.table("models")
            .select("id")
            .eq("version", bundle_name)
            .limit(1)
            .execute()
        )
        row = {
            "version": bundle_name,
            "file_hash": file_hash,
            "metadata": metadata,
            "is_active": is_active,
            "description": description or f"Bundle {bundle_name}",
        }
        if is_active:
            supabase_client.client.table("models").update(
                {"is_active": False}
            ).neq("version", bundle_name).execute()

        if existing.data:
            model_id = existing.data[0]["id"]
            supabase_client.client.table("models").update(row).eq(
                "id", model_id
            ).execute()
        else:
            supabase_client.client.table("models").insert(row).execute()
    except Exception as e:
        logger.error("Failed to upsert models row: %s", e)
        raise


def deactivate_all_models(supabase_client) -> None:
    if supabase_client is None:
        return
    try:
        supabase_client.client.table("models").update({"is_active": False}).execute()
    except Exception as e:
        logger.warning("Failed to deactivate models: %s", e)
