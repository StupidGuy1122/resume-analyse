"""Tests for the streaming partial-JSON parser and the streaming pipeline."""
from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from app.agent import pipeline
from app.agent.schemas import StructuredResume


async def _to_async_iter(strings: list[str]) -> AsyncIterator[str]:
    for s in strings:
        yield s


@pytest.mark.asyncio
async def test_stream_items_parses_complete_objects_chunked():
    """Chunks split mid-object should not be emitted twice."""
    # Two complete items, fed in 4 awkward chunks.
    chunks = [
        '{"items":[{"section":"summary","original":"hi"',
        ',"suggestion":"hi there","reason":"r","priority":"high"',
        '},{"section":"summary","original":"x","suggestion":"y","reason":"z","priority":"low"}]',
        '}',
    ]
    # Pre-build cumulative buffer the way the real client streams it.
    cumulative = []
    acc = ""
    for c in chunks:
        acc += c
        cumulative.append(acc)

    out = []
    async for item in pipeline._stream_items(_to_async_iter(cumulative)):
        out.append(item)

    assert len(out) == 2
    assert out[0]["original"] == "hi"
    assert out[1]["priority"] == "low"


@pytest.mark.asyncio
async def test_stream_items_handles_bare_list():
    """Some models emit a bare ``[{...}]`` instead of ``{"items":[...]}``."""
    cumulative = ['[{"a":1', '},{"a":2}]']
    acc = ""
    bufs = []
    for c in cumulative:
        acc += c
        bufs.append(acc)

    out = []
    async for item in pipeline._stream_items(_to_async_iter(bufs)):
        out.append(item)
    assert out == [{"a": 1}, {"a": 2}]


@pytest.mark.asyncio
async def test_stream_items_handles_braces_in_strings():
    """Curly braces inside string values must not be counted as object boundaries."""
    cumulative = [
        '{"items":[{"original":"a } b { c","priority":"high",',
        '"section":"summary","suggestion":"x","reason":"y"}]}',
    ]
    acc = ""
    bufs = []
    for c in cumulative:
        acc += c
        bufs.append(acc)
    out = []
    async for item in pipeline._stream_items(_to_async_iter(bufs)):
        out.append(item)
    assert len(out) == 1
    assert out[0]["original"] == "a } b { c"


class FakeStreamingOllama:
    """Mock client that exposes only the streaming method."""

    def __init__(self, cumulative_chunks: list[str]):
        self._chunks = cumulative_chunks

    async def chat_json_stream(self, system: str, user: str, *, temperature: float = 0.2):  # noqa: ARG002
        for c in self._chunks:
            yield c


@pytest.mark.asyncio
async def test_stream_suggestions_yields_grounded_items_only():
    """End-to-end: streaming pipeline applies grounding per item."""
    raw_text = "Built a thing. Shipped fast."
    cumulative = [
        '{"items":[{"section":"work_experience",'
        '"original":"Built a thing","suggestion":"Built a scalable thing serving 10k QPS",'
        '"reason":"add quantification","priority":"high"}',
        ',{"section":"work_experience",'
        '"original":"Single-handedly delivered a $50M product line",'
        '"suggestion":"...","reason":"...","priority":"high"}]}',
    ]
    fake = FakeStreamingOllama(cumulative)
    out = []
    async for item in pipeline.stream_suggestions(raw_text, StructuredResume(), client=fake):  # type: ignore[arg-type]
        out.append(item)
    assert len(out) == 1
    assert "Built a thing" in out[0].original
