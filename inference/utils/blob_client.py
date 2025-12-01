"""
Lightweight HTTP client for interacting with Vercel Blob storage.

The official `@vercel/blob` package targets JavaScript runtimes. This module
implements the minimal subset of the API that we need (upload, download,
metadata lookup, deletion, listing) directly against the public HTTP API so
that the Python inference server can participate in the delsame workflows.
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

DEFAULT_API_URL = os.getenv("VERCEL_BLOB_API_URL", "https://vercel.com/api/blob")
API_VERSION = os.getenv("VERCEL_BLOB_API_VERSION_OVERRIDE") or "11"


class BlobClient:
    """Small helper around the Vercel Blob HTTP API."""

    def __init__(self, token: str, api_url: Optional[str] = None, timeout: float = 120.0):
        if not token:
            raise ValueError("BLOB_READ_WRITE_TOKEN is required for BlobClient")

        self.token = token
        self.api_url = api_url or DEFAULT_API_URL
        self.timeout = timeout
        self._store_id = self._extract_store_id(token)

    @staticmethod
    def _extract_store_id(token: str) -> str:
        parts = token.split("_")
        return parts[3] if len(parts) > 3 else "python"

    def _base_headers(self, content_length: Optional[int] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "authorization": f"Bearer {self.token}",
            "x-api-version": API_VERSION,
            "x-api-blob-request-id": f"{self._store_id}:{int(time.time() * 1000)}:{uuid.uuid4().hex[:8]}",
            "x-api-blob-request-attempt": "0",
        }
        if content_length is not None:
            headers["x-content-length"] = str(content_length)
        return headers

    def upload_bytes(
        self,
        pathname: str,
        content: bytes,
        *,
        content_type: str = "application/octet-stream",
        allow_overwrite: bool = True,
        add_random_suffix: bool = False,
    ) -> Dict[str, str]:
        """Upload raw bytes to Vercel Blob."""
        params = urlencode({"pathname": pathname})
        headers = self._base_headers(len(content))
        headers["x-content-type"] = content_type
        headers["x-allow-overwrite"] = "1" if allow_overwrite else "0"
        headers["x-add-random-suffix"] = "1" if add_random_suffix else "0"

        url = f"{self.api_url}/?{params}"
        logger.info("Uploading blob to %s", pathname)

        with httpx.Client(timeout=self.timeout) as client:
            response = client.put(url, content=content, headers=headers)
            response.raise_for_status()
            payload = response.json()
            logger.info("Uploaded blob %s (%s)", pathname, payload.get("url"))
            return payload

    def delete(self, paths: Iterable[str]) -> None:
        """Delete one or multiple blobs."""
        path_list = [path for path in paths if path]
        if not path_list:
            return

        url = f"{self.api_url}/delete"
        headers = self._base_headers()
        headers["content-type"] = "application/json"

        body = {"urls": path_list}
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=body, headers=headers)
            response.raise_for_status()
            logger.info("Deleted blobs: %s", ", ".join(path_list))

    def head(self, url_or_path: str) -> Dict[str, str]:
        """Fetch metadata for a blob object."""
        params = urlencode({"url": url_or_path})
        url = f"{self.api_url}/?{params}"
        headers = self._base_headers()

        with httpx.Client(timeout=self.timeout) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()

    def list(self, prefix: Optional[str] = None, cursor: Optional[str] = None) -> Dict[str, List[Dict[str, str]]]:
        """List blobs in the store (optionally filtered by prefix)."""
        params = {}
        if prefix:
            params["prefix"] = prefix
        if cursor:
            params["cursor"] = cursor
        query = f"?{urlencode(params)}" if params else ""

        headers = self._base_headers()
        url = f"{self.api_url}/{query}"

        with httpx.Client(timeout=self.timeout) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return {
                "blobs": data.get("blobs", []),
                "cursor": data.get("cursor"),
                "hasMore": data.get("hasMore", False),
            }

    def download(self, download_url: str, destination: Path) -> None:
        """Download the blob referenced by `download_url` to `destination`."""
        destination.parent.mkdir(parents=True, exist_ok=True)
        with httpx.Client(timeout=self.timeout) as client, client.stream("GET", download_url) as response:
            response.raise_for_status()
            with destination.open("wb") as out_file:
                for chunk in response.iter_bytes():
                    if chunk:
                        out_file.write(chunk)

    def ensure_local_copy(
        self, blob_path: str, destination: Path, download_url: Optional[str] = None
    ) -> Optional[str]:
        """Ensure a blob exists locally by downloading it when necessary."""
        if destination.exists():
            return download_url

        metadata = None
        if not download_url:
            try:
                metadata = self.head(blob_path)
            except httpx.HTTPStatusError as error:
                logger.error("Failed to locate blob %s: %s", blob_path, error)
                raise
            download_url = metadata.get("downloadUrl") or metadata.get("url")

        if not download_url:
            raise RuntimeError(f"Unable to resolve download URL for blob {blob_path}")

        logger.info("Downloading blob %s to %s", blob_path, destination)
        self.download(download_url, destination)
        return download_url

