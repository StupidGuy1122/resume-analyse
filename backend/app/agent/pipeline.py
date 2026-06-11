"""Two-step Agent pipeline:

1. ``extract_structured`` — raw resume text → structured JSON
2. ``analyze_*``           — structured JSON → suggestions / interview questions

Each step retries up to ``MAX_RETRIES`` times if the model returns malformed JSON.
"""
from __future__ import annotations

import json
import logging

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

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RAW_EXCERPT_LEN = 1500


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
            logger.warning("LLM JSON parse failed (attempt %d/%d): %s", attempt + 1, MAX_RETRIES + 1, exc)
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
        # Best-effort: fall back to an empty structure so downstream steps still run.
        return StructuredResume()


async def analyze_suggestions(
    resume_id: str,
    raw_text: str,
    structured: StructuredResume,
    *,
    client: OllamaClient | None = None,
) -> SuggestionsResult:
    """Step 2a: produce improvement suggestions."""
    client = client or get_client()
    structured_json = structured.model_dump_json()
    raw_excerpt = raw_text[:RAW_EXCERPT_LEN]
    raw = await _chat_json_with_retry(
        client,
        system=prompts.SUGGESTIONS_SYSTEM,
        user=prompts.suggestions_user_prompt(structured_json, raw_excerpt),
        temperature=0.3,
    )
    items = _coerce_items(raw, SuggestionItem)
    return SuggestionsResult(resume_id=resume_id, items=items)


async def analyze_interview_questions(
    resume_id: str,
    structured: StructuredResume,
    *,
    client: OllamaClient | None = None,
) -> InterviewQuestionsResult:
    """Step 2b: predict likely interview questions."""
    client = client or get_client()
    structured_json = structured.model_dump_json()
    raw = await _chat_json_with_retry(
        client,
        system=prompts.INTERVIEW_SYSTEM,
        user=prompts.interview_user_prompt(structured_json),
        temperature=0.4,
    )
    items = _coerce_items(raw, InterviewQuestion)
    return InterviewQuestionsResult(resume_id=resume_id, items=items)


def _coerce_items(raw: dict, item_cls):
    """Tolerate models that return ``{"items": [...]}`` *or* a bare list."""
    candidates = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(candidates, list):
        logger.warning("Expected list of items, got: %s", json.dumps(raw)[:200])
        return []
    out = []
    for c in candidates:
        try:
            out.append(item_cls.model_validate(c))
        except ValidationError as exc:
            logger.debug("Dropping invalid item: %s (%s)", c, exc)
    return out
