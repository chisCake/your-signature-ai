"""Build CORS allow_origins / allow_origin_regex from FRONTEND_URL."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Iterable, Optional

DEFAULT_DEV_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000",
)


@dataclass(frozen=True)
class CorsConfig:
    allow_origins: list[str]
    allow_origin_regex: Optional[str]


def _normalize_origin(url: str) -> str:
    return url.strip().rstrip("/")


def _is_glob_pattern(entry: str) -> bool:
    return "*" in entry


def _is_raw_regex(entry: str) -> bool:
    return entry.startswith("^") or entry.startswith("regex:")


def glob_pattern_to_origin_regex(pattern: str) -> str:
    """Turn a glob-like origin pattern (* = any substring) into a full-match regex."""
    pattern = pattern.strip()
    if not pattern:
        raise ValueError("empty CORS origin pattern")

    parts = pattern.split("*")
    escaped = [re.escape(part) for part in parts]
    body = ".*".join(escaped)
    return f"^{body}$"


def _raw_regex(entry: str) -> str:
    entry = entry.strip()
    if entry.startswith("regex:"):
        entry = entry[len("regex:") :].strip()
    if not entry.startswith("^"):
        entry = f"^{entry}"
    if not entry.endswith("$"):
        entry = f"{entry}$"
    return entry


def parse_frontend_url_entries(entries: Iterable[str]) -> tuple[list[str], list[str]]:
    """Split FRONTEND_URL tokens into exact origins and origin regexes."""
    origins: list[str] = []
    regexes: list[str] = []

    for raw in entries:
        entry = raw.strip()
        if not entry:
            continue
        if _is_raw_regex(entry):
            regexes.append(_raw_regex(entry))
        elif _is_glob_pattern(entry):
            regexes.append(glob_pattern_to_origin_regex(entry))
        else:
            origins.append(_normalize_origin(entry))

    return origins, regexes


def build_cors_config(
    frontend_url: Optional[str] = None,
    *,
    include_dev_origins: bool = True,
) -> CorsConfig:
    raw = frontend_url if frontend_url is not None else os.getenv(
        "FRONTEND_URL", "http://localhost:3000"
    )
    entries = [part.strip() for part in raw.split(",") if part.strip()]

    origins, regexes = parse_frontend_url_entries(entries)

    if include_dev_origins:
        origins = list(dict.fromkeys(origins + list(DEFAULT_DEV_ORIGINS)))
    else:
        origins = list(dict.fromkeys(origins))

    allow_origin_regex: Optional[str] = None
    if regexes:
        allow_origin_regex = "|".join(f"({r})" for r in regexes)

    return CorsConfig(allow_origins=origins, allow_origin_regex=allow_origin_regex)
