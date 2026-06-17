"""Two-step Agent pipeline:

1. ``extract_structured`` — raw resume text → structured JSON
2. ``analyze_*``           — structured JSON → suggestions / interview questions

Each step retries up to ``MAX_RETRIES`` times if the model returns malformed JSON.

Streaming variants (``stream_suggestions`` / ``stream_interview_questions``) yield
items one at a time as the model produces them, so the UI can render progressively.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from pydantic import ValidationError

from app.agent import prompts
from app.agent.ollama_client import OllamaClient, get_client
from app.agent.schemas import StructuredResume
from app.schemas.analysis import (
    InterviewQuestion,
    InterviewQuestionsResult,
    SuggestionItem,
    SuggestionsResult,
)
from app.services.grounding import filter_grounded_items

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


async def _chat_json_with_retry(
    client: OllamaClient,
    system: str,
    user: str,
    *,
    temperature: float = 0.2,
) -> dict:
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            return await client.chat_json(system=system, user=user, temperature=temperature)
        except ValueError as exc:
            last_err = exc
            logger.warning(
                "LLM JSON parse failed (attempt %d/%d): %s",
                attempt + 1, MAX_RETRIES + 1, exc,
            )
    assert last_err is not None
    raise last_err


async def extract_structured(resume_text: str, client: OllamaClient | None = None) -> StructuredResume:
    """Step 1: LLM extracts a typed structure from raw resume text."""
    client = client or get_client()
    raw = await _chat_json_with_retry(
        client,
        system=prompts.EXTRACT_SYSTEM,
        user=prompts.extract_user_prompt(resume_text),
        temperature=0.1,
    )
    try:
        return StructuredResume.model_validate(raw)
    except ValidationError as exc:
        logger.warning("Extracted JSON failed validation, using best-effort: %s", exc)
        return StructuredResume()


# ---------------------------------------------------------------------------
# Synchronous (one-shot) variants — kept for the non-streaming endpoints.
# ---------------------------------------------------------------------------

async def analyze_suggestions(
    resume_id: str,
    raw_text: str,
    structured: StructuredResume,
    *,
    client: OllamaClient | None = None,
) -> SuggestionsResult:
    """Step 2a: produce improvement suggestions (one-shot)."""
    client = client or get_client()
    structured_json = structured.model_dump_json()
    raw = await _chat_json_with_retry(
        client,
        system=prompts.SUGGESTIONS_SYSTEM,
        user=prompts.suggestions_user_prompt(structured_json, raw_text),
        temperature=0.3,
    )
    items = _coerce_items(raw, SuggestionItem)
    items = filter_grounded_items(items, raw_text, field="original")
    return SuggestionsResult(resume_id=resume_id, items=items)


async def analyze_interview_questions(
    resume_id: str,
    raw_text: str,
    structured: StructuredResume,
    *,
    client: OllamaClient | None = None,
) -> InterviewQuestionsResult:
    """Step 2b: predict likely interview questions (one-shot)."""
    client = client or get_client()
    structured_json = structured.model_dump_json()
    raw = await _chat_json_with_retry(
        client,
        system=prompts.INTERVIEW_SYSTEM,
        user=prompts.interview_user_prompt(structured_json, raw_text),
        temperature=0.4,
    )
    items = _coerce_items(raw, InterviewQuestion)
    return InterviewQuestionsResult(resume_id=resume_id, items=items)


# ---------------------------------------------------------------------------
# Streaming variants — yield items as they're produced.
# ---------------------------------------------------------------------------

async def stream_suggestions(
    raw_text: str,
    structured: StructuredResume,
    *,
    client: OllamaClient | None = None,
) -> AsyncIterator[SuggestionItem]:
    """Yield SuggestionItem objects one-by-one as the LLM emits them.

    Each yielded item has already passed both:
      - Pydantic validation
      - grounding check against raw_text (hallucinated `original` → dropped)
    """
    client = client or get_client()
    structured_json = structured.model_dump_json()
    chunks = client.chat_json_stream(
        system=prompts.SUGGESTIONS_SYSTEM,
        user=prompts.suggestions_user_prompt(structured_json, raw_text),
        temperature=0.3,
    )
    async for raw_item in _stream_items(chunks):
        try:
            item = SuggestionItem.model_validate(raw_item)
        except ValidationError as exc:
            logger.debug("dropping invalid streamed suggestion: %s (%s)", raw_item, exc)
            continue
        # Per-item grounding check — only yield if `original` is really in the resume.
        kept = filter_grounded_items([item], raw_text, field="original")
        if kept:
            yield kept[0]


async def stream_interview_questions(
    raw_text: str,
    structured: StructuredResume,
    *,
    client: OllamaClient | None = None,
) -> AsyncIterator[InterviewQuestion]:
    """Yield InterviewQuestion objects one-by-one as the LLM emits them."""
    client = client or get_client()
    structured_json = structured.model_dump_json()
    chunks = client.chat_json_stream(
        system=prompts.INTERVIEW_SYSTEM,
        user=prompts.interview_user_prompt(structured_json, raw_text),
        temperature=0.4,
    )
    async for raw_item in _stream_items(chunks):
        try:
            yield InterviewQuestion.model_validate(raw_item)
        except ValidationError as exc:
            logger.debug("dropping invalid streamed question: %s (%s)", raw_item, exc)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _coerce_items(raw: dict | list, item_cls):
    """Tolerate models that return ``{"items": [...]}`` *or* a bare list."""
    candidates = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(candidates, list):
        logger.warning("expected list of items, got: %s", json.dumps(raw)[:200])
        return []
    out = []
    for c in candidates:
        try:
            out.append(item_cls.model_validate(c))
        except ValidationError as exc:
            logger.debug("dropping invalid item: %s (%s)", c, exc)
    return out


async def _stream_items(chunks: AsyncIterator[str]) -> AsyncIterator[dict]:
    """Pull complete JSON objects out of a streaming JSON array.

    The model is producing ``{"items": [{...}, {...}, ...]}`` (or a bare
    ``[{...}, ...]``). We watch the cumulative buffer and, whenever a new
    top-level ``{...}`` object closes inside the array, parse and emit it.

    Tolerates the same shape ambiguity as ``_coerce_items``: both
    ``{"items":[...]}`` and bare-list responses work.
    """
    last_emitted = 0  # index in buffer past which we've already emitted

    async for buf in chunks:
        # Walk forward from where we left off, looking for top-level objects.
        # "Top-level" means depth 1 (we're inside the outer array, but not
        # inside any nested object/array of the current item).
        i = last_emitted
        # Skip ahead to the start of the items array on the very first pass.
        if last_emitted == 0:
            arr_start = _find_array_start(buf)
            if arr_start < 0:
                continue
            i = arr_start + 1  # past the '['

        depth = 0
        in_string = False
        escape = False
        item_start = -1

        # Advance through the buffer scanning for complete `{...}` items.
        while i < len(buf):
            ch = buf[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
            else:
                if ch == '"':
                    in_string = True
                elif ch == "{":
                    if depth == 0:
                        item_start = i
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0 and item_start >= 0:
                        # Complete object ready.
                        chunk = buf[item_start : i + 1]
                        try:
                            obj = json.loads(chunk)
                        except json.JSONDecodeError:
                            # Shouldn't happen — but be defensive against
                            # malformed escape sequences.
                            obj = None
                        if isinstance(obj, dict):
                            yield obj
                        last_emitted = i + 1
                        item_start = -1
            i += 1
        # Nothing more to do until next chunk.


def _find_array_start(buf: str) -> int:
    """Return the index of the first '[' that opens the items array.

    Handles both ``{"items": [...]}`` (where '[' comes after `"items":`)
    and bare ``[...]`` outputs.
    """
    in_string = False
    escape = False
    for i, ch in enumerate(buf):
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == "[":
                return i
    return -1
