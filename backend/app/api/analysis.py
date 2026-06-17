"""Analysis endpoints — improvement suggestions & interview question prediction."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agent.pipeline import (
    analyze_interview_questions,
    analyze_suggestions,
    extract_structured,
    stream_interview_questions,
    stream_suggestions,
)
from app.schemas.analysis import (
    InterviewQuestion,
    InterviewQuestionsResult,
    SuggestionItem,
    SuggestionsResult,
)
from app.services.storage import store

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_resume(resume_id: str):
    parsed = store.get_resume(resume_id)
    if parsed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found.")
    return parsed


@router.post("/{resume_id}/suggestions", response_model=SuggestionsResult)
async def suggestions(resume_id: str) -> SuggestionsResult:
    """Synchronous endpoint — returns improvement suggestions in one shot."""
    parsed = _require_resume(resume_id)
    cached = store.get_analysis(resume_id, "suggestions")
    if cached is not None:
        return cached

    try:
        structured = await extract_structured(parsed.raw_text)
        result = await analyze_suggestions(resume_id, parsed.raw_text, structured)
    except Exception as exc:  # noqa: BLE001
        logger.exception("suggestions pipeline failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Agent failure: {exc}") from exc

    store.put_analysis(resume_id, "suggestions", result)
    return result


@router.post("/{resume_id}/interview-questions", response_model=InterviewQuestionsResult)
async def interview_questions(resume_id: str) -> InterviewQuestionsResult:
    """Synchronous endpoint — returns predicted interview questions."""
    parsed = _require_resume(resume_id)
    cached = store.get_analysis(resume_id, "interview")
    if cached is not None:
        return cached

    try:
        structured = await extract_structured(parsed.raw_text)
        result = await analyze_interview_questions(resume_id, parsed.raw_text, structured)
    except Exception as exc:  # noqa: BLE001
        logger.exception("interview-questions pipeline failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Agent failure: {exc}") from exc

    store.put_analysis(resume_id, "interview", result)
    return result


@router.post("/{resume_id}/full")
async def full_analysis_stream(resume_id: str) -> StreamingResponse:
    """Streaming endpoint — sends NDJSON events as the analysis progresses.

    Event sequence (each line is one JSON object):
      {"stage": "extract:start"}
      {"stage": "extract:done"}
      {"stage": "suggestions:start"}
      {"stage": "suggestion:item", "data": SuggestionItem}   ← repeated, one per item
      {"stage": "suggestions:done", "data": SuggestionsResult}
      {"stage": "interview:start"}
      {"stage": "interview:item",   "data": InterviewQuestion} ← repeated
      {"stage": "interview:done",   "data": InterviewQuestionsResult}
      {"stage": "all:done"}

    On error: {"stage": "error", "message": "..."} mid-stream.
    """
    parsed = _require_resume(resume_id)

    async def gen():
        def event(payload: dict) -> bytes:
            return (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")

        try:
            yield event({"stage": "extract:start"})
            structured = await extract_structured(parsed.raw_text)
            yield event({"stage": "extract:done"})

            # ---- Suggestions: stream items as they arrive ----
            yield event({"stage": "suggestions:start"})
            sug_items: list[SuggestionItem] = []
            async for item in stream_suggestions(parsed.raw_text, structured):
                sug_items.append(item)
                yield event({"stage": "suggestion:item", "data": item.model_dump()})
            sug_result = SuggestionsResult(resume_id=resume_id, items=sug_items)
            store.put_analysis(resume_id, "suggestions", sug_result)
            yield event({"stage": "suggestions:done", "data": sug_result.model_dump()})

            # ---- Interview questions: stream items as they arrive ----
            yield event({"stage": "interview:start"})
            iq_items: list[InterviewQuestion] = []
            async for item in stream_interview_questions(parsed.raw_text, structured):
                iq_items.append(item)
                yield event({"stage": "interview:item", "data": item.model_dump()})
            iq_result = InterviewQuestionsResult(resume_id=resume_id, items=iq_items)
            store.put_analysis(resume_id, "interview", iq_result)
            yield event({"stage": "interview:done", "data": iq_result.model_dump()})

            yield event({"stage": "all:done"})
        except Exception as exc:  # noqa: BLE001
            logger.exception("streaming analysis failed")
            yield event({"stage": "error", "message": str(exc)})

    return StreamingResponse(gen(), media_type="application/x-ndjson")
