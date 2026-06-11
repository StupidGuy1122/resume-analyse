"""Health check endpoint."""
from __future__ import annotations

import httpx
from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness — process is up."""
    return {"status": "ok"}


@router.get("/health/ollama")
async def health_ollama() -> dict[str, object]:
    """Readiness — can we reach Ollama?"""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_host}/api/tags")
            r.raise_for_status()
            tags = r.json().get("models", [])
            return {
                "status": "ok",
                "host": settings.ollama_host,
                "model": settings.ollama_model,
                "available_models": [m.get("name") for m in tags],
            }
    except Exception as exc:  # noqa: BLE001
        return {"status": "unreachable", "host": settings.ollama_host, "error": str(exc)}
