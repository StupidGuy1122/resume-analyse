"""Mock interview agent — three async pipelines:

  1. ``stream_questions``         — yield InterviewQuestion as they're generated
  2. ``evaluate_answer``          — score one answer + give feedback
  3. ``generate_report``          — final overall evaluation

Each piece is composable and uses streaming where it improves UX.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from pydantic import ValidationError

from app.agent import interview_prompts as iprompts
from app.agent.ollama_client import OllamaClient, get_client
from app.agent.pipeline import _stream_items
from app.schemas.interview_session import (
    Answer,
    InterviewQuestion,
    InterviewReport,
)

logger = logging.getLogger(__name__)


async def stream_questions(
    resume_text: str,
    *,
    question_count: int,
    difficulty: str,
    asked_summaries: list[str] | None = None,
    client: OllamaClient | None = None,
) -> AsyncIterator[InterviewQuestion]:
    """Yield InterviewQuestion objects as the LLM emits them.

    The model's output is a JSON array of items; we use the same
    ``_stream_items`` parser that powers /full so each new ``{...}``
    that closes inside the items[] array is parsed and yielded.
    """
    client = client or get_client()
    chunks = client.chat_json_stream(
        system=iprompts.QUESTION_GEN_SYSTEM,
        user=iprompts.question_gen_user_prompt(
            resume_text=resume_text,
            question_count=question_count,
            difficulty=difficulty,
            asked_summaries=asked_summaries,
        ),
        temperature=0.4,
    )
    idx = 0
    async for raw in _stream_items(chunks):
        # The schema's `index` is server-assigned, not from the model.
        raw["index"] = idx
        try:
            yield InterviewQuestion.model_validate(raw)
            idx += 1
        except ValidationError as exc:
            logger.debug("dropping invalid streamed question: %s (%s)", raw, exc)


async def evaluate_answer(
    question: InterviewQuestion,
    user_answer: str,
    *,
    client: OllamaClient | None = None,
) -> Answer:
    """One LLM call → score + feedback + reference answer for a single Q/A pair."""
    client = client or get_client()
    raw = await client.chat_json(
        system=iprompts.ANSWER_EVAL_SYSTEM,
        user=iprompts.answer_eval_user_prompt(
            question=question.question,
            user_answer=user_answer,
            related_section=question.related_section,
        ),
        temperature=0.2,
    )

    # Defensive coercion — the model occasionally wraps the result.
    if "score" not in raw and "result" in raw:
        raw = raw["result"]

    score = _coerce_score(raw.get("score"))
    feedback = str(raw.get("feedback", "")).strip()
    reference = str(raw.get("reference_answer", "")).strip()

    return Answer(
        question_index=question.index,
        user_answer=user_answer,
        score=score,
        feedback=feedback or "（模型未返回有效反馈）",
        reference_answer=reference,
    )


async def stream_report(
    session_id: str,
    resume_text: str,
    questions: list[InterviewQuestion],
    answers: list[Answer],
    *,
    client: OllamaClient | None = None,
) -> AsyncIterator[dict]:
    """Yield report fragments as they're produced.

    Yields, in order:
      {"phase": "overall",     "data": {"overall_score", "overall_feedback"}}
      {"phase": "strength",    "data": "<one strength>"}    ← repeated
      {"phase": "improvement", "data": "<one improvement>"} ← repeated
      {"phase": "category",    "data": CategoryScore}        ← repeated
      {"phase": "done",        "data": InterviewReport}      ← final assembly

    The model produces one big JSON; we stream by emitting list items as soon
    as their closing ``}`` (or string close ``"``) shows up in the buffer.
    For brevity here we just buffer the full response, parse, then emit each
    section in sequence — this still streams to the user (one fetch read =
    one yield) but keeps parsing simple. A full incremental parser like
    `_stream_items` would be over-engineered for a structure this small.
    """
    client = client or get_client()

    qa_records = [
        {
            "question": q.question,
            "related_section": q.related_section,
            "user_answer": a.user_answer,
            "score": a.score,
            "feedback": a.feedback,
        }
        for q, a in zip(questions, answers, strict=False)
    ]

    raw = await client.chat_json(
        system=iprompts.REPORT_SYSTEM,
        user=iprompts.report_user_prompt(resume_excerpt=resume_text, qa_records=qa_records),
        temperature=0.3,
    )

    overall_score = _coerce_score(raw.get("overall_score"))
    overall_feedback = str(raw.get("overall_feedback", "")).strip()

    yield {"phase": "overall", "data": {"overall_score": overall_score, "overall_feedback": overall_feedback}}

    strengths_raw = raw.get("strengths") or []
    if isinstance(strengths_raw, list):
        for s in strengths_raw:
            if isinstance(s, str) and s.strip():
                yield {"phase": "strength", "data": s.strip()}

    improvements_raw = raw.get("improvements") or []
    if isinstance(improvements_raw, list):
        for s in improvements_raw:
            if isinstance(s, str) and s.strip():
                yield {"phase": "improvement", "data": s.strip()}

    category_raw = raw.get("category_scores") or []
    categories = []
    if isinstance(category_raw, list):
        for c in category_raw:
            try:
                cat = {
                    "category": str(c.get("category", "")).strip(),
                    "score": _coerce_score(c.get("score")),
                    "question_count": int(c.get("question_count", 0) or 0),
                }
                if cat["category"]:
                    categories.append(cat)
                    yield {"phase": "category", "data": cat}
            except Exception:  # noqa: BLE001
                logger.debug("dropping bad category: %s", c)

    final = InterviewReport(
        session_id=session_id,
        overall_score=overall_score,
        overall_feedback=overall_feedback,
        strengths=[s.strip() for s in strengths_raw if isinstance(s, str) and s.strip()],
        improvements=[s.strip() for s in improvements_raw if isinstance(s, str) and s.strip()],
        category_scores=[
            {"category": c["category"], "score": c["score"], "question_count": c["question_count"]}
            for c in categories
        ],
    )
    yield {"phase": "done", "data": final.model_dump()}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _coerce_score(v) -> int:
    """Clamp and coerce to [0, 100]. Models occasionally return strings."""
    try:
        n = int(v) if v is not None else 0
    except (TypeError, ValueError):
        try:
            n = int(float(v))
        except (TypeError, ValueError):
            n = 0
    return max(0, min(100, n))


__all__ = ["stream_questions", "evaluate_answer", "stream_report"]


# expose json for tests / ad-hoc REPL use
_ = json  # keep import (used implicitly via _stream_items chunks)
