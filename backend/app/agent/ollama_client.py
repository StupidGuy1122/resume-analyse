"""Thin wrapper over the Ollama Python client.

Centralised so pipeline code doesn't depend on ollama internals,
making it easy to mock in tests or swap providers later.
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from ollama import AsyncClient

from app.config import get_settings


class OllamaClient:
    """Async chat helper that always asks for JSON output."""

    def __init__(self, host: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        self.host = host or settings.ollama_host
        self.model = model or settings.ollama_model
        self.timeout = settings.ollama_timeout
        self._client = AsyncClient(host=self.host, timeout=self.timeout)

    async def chat_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """Run a single chat turn that returns a parsed JSON object.

        Uses Ollama's `format='json'` so the model is biased toward valid JSON.
        Raises ValueError if parsing fails.
        """
        response = await self._client.chat(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            format="json",
            options={"temperature": temperature},
        )
        content = response["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Model did not return valid JSON: {content[:300]}...") from exc

    async def chat_json_stream(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.2,
    ) -> AsyncIterator[str]:
        """Stream the model's JSON output as a sequence of text chunks.

        Yields the *cumulative* JSON string after each chunk arrives — callers
        can attempt incremental parsing on every yield to detect newly-completed
        items (see ``pipeline._stream_items`` for the consumer side).

        We yield the cumulative buffer (not just deltas) so callers don't have
        to maintain their own state.
        """
        stream = await self._client.chat(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            format="json",
            options={"temperature": temperature},
            stream=True,
        )
        buf: list[str] = []
        async for part in stream:
            chunk = part.get("message", {}).get("content", "")
            if chunk:
                buf.append(chunk)
                yield "".join(buf)


# Lazy singleton — instantiated on first use to avoid event-loop issues at import time.
_client: OllamaClient | None = None


def get_client() -> OllamaClient:
    global _client
    if _client is None:
        _client = OllamaClient()
    return _client
