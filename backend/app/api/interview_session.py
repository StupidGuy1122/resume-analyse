"""Mock-interview session endpoints.

5 endpoints, three of them streaming NDJSON for snappy UX:
  POST   /api/interview-session/start            → stream session:created + question:item × N
  GET    /api/interview-session/{sid}            → full session snapshot (refresh-safe)
  POST   /api/interview-session/{sid}/answer     → stream eval:done + next:question
  POST   /api/interview-session/{sid}/finish     → stream report:* events
  DELETE /api/interview-session/{sid}            → drop the session
"""
from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agent.interview_agent import (
    evaluate_answer,
    stream_questions,
    stream_report,
)
from app.schemas.interview_session import (
    Answer,
    InterviewSession,
    StartInterviewRequest,
    SubmitAnswerRequest,
)
from app.services.storage import store

logger = logging.getLogger(__name__)
router = APIRouter()


def _ndjson(payload: dict) -> bytes:
    return (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")


@router.post("/start")
async def start_session(req: StartInterviewRequest) -> StreamingResponse:
    """Streaming endpoint — emits session metadata first (so the frontend can
    navigate immediately) then question items as they arrive.

    Event sequence:
      {"event": "session:created",  "data": InterviewSession (status=generating)}
      {"event": "question:item",    "data": InterviewQuestion}    ← repeated
      {"event": "questions:done",   "data": InterviewSession (status=ready)}
      {"event": "error",            "message": "..."}              ← on failure
    """
    parsed = store.get_resume(req.resume_id)
    if parsed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found.")

    session = InterviewSession(
        session_id=uuid.uuid4().hex,
        resume_id=req.resume_id,
        difficulty=req.difficulty,
        question_count=req.question_count,
        status="generating",
    )
    store.put_session(session)

    async def gen():
        try:
            yield _ndjson({"event": "session:created", "data": session.model_dump()})

            async for q in stream_questions(
                resume_text=parsed.raw_text,
                question_count=req.question_count,
                difficulty=req.difficulty,
            ):
                # The model returns its own question.index; reassign deterministically.
                q.index = len(session.questions)
                session.questions.append(q)
                store.put_session(session)
                yield _ndjson({"event": "question:item", "data": q.model_dump()})

            session.status = "ready"
            store.put_session(session)
            yield _ndjson({"event": "questions:done", "data": session.model_dump()})
        except Exception as exc:  # noqa: BLE001
            logger.exception("interview question generation failed")
            yield _ndjson({"event": "error", "message": str(exc)})

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.get("/{session_id}")
async def get_session(session_id: str) -> InterviewSession:
    s = store.get_session(session_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    return s


@router.post("/{session_id}/answer")
async def submit_answer(session_id: str, req: SubmitAnswerRequest) -> StreamingResponse:
    """Streaming endpoint — evaluates the submitted answer, advances the cursor,
    and returns the next question (or signals completion).

    Event sequence:
      {"event": "eval:start"}
      {"event": "eval:done",       "data": Answer (with score + feedback)}
      {"event": "next:question",   "data": InterviewQuestion | null}
      {"event": "session:complete"}        ← when no more questions
      {"event": "error",           "message": "..."}
    """
    session = store.get_session(session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    if session.status not in ("ready", "in_progress"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Session is {session.status}, no more answers can be submitted.",
        )
    if not (0 <= req.question_index < len(session.questions)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "question_index out of range")

    question = session.questions[req.question_index]

    async def gen():
        try:
            yield _ndjson({"event": "eval:start"})
            answer = await evaluate_answer(question, req.user_answer)
            # Re-fetch session to avoid clobbering any concurrent updates.
            current = store.get_session(session_id)
            if current is None:
                yield _ndjson({"event": "error", "message": "Session disappeared mid-evaluation."})
                return
            current.answers = [a for a in current.answers if a.question_index != req.question_index]
            current.answers.append(answer)
            current.status = "in_progress"
            current.current_index = req.question_index + 1
            if current.current_index >= len(current.questions):
                current.status = "completed"
            store.put_session(current)
            yield _ndjson({"event": "eval:done", "data": answer.model_dump()})

            if current.status == "completed":
                yield _ndjson({"event": "next:question", "data": None})
                yield _ndjson({"event": "session:complete"})
            else:
                next_q = current.questions[current.current_index]
                yield _ndjson({"event": "next:question", "data": next_q.model_dump()})
        except Exception as exc:  # noqa: BLE001
            logger.exception("answer evaluation failed")
            yield _ndjson({"event": "error", "message": str(exc)})

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.post("/{session_id}/finish")
async def finish_session(session_id: str) -> StreamingResponse:
    """Streaming endpoint — generates the final report and persists it.

    Event sequence:
      {"event": "report:overall",      "data": {"overall_score", "overall_feedback"}}
      {"event": "report:strength",     "data": "<one strength>"}      ← repeated
      {"event": "report:improvement",  "data": "<one improvement>"}   ← repeated
      {"event": "report:category",     "data": CategoryScore}         ← repeated
      {"event": "report:done",         "data": InterviewReport}       ← final
      {"event": "error",               "message": "..."}
    """
    session = store.get_session(session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    if not session.answers:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No answers submitted yet.")

    parsed = store.get_resume(session.resume_id)
    resume_text = parsed.raw_text if parsed else ""

    async def gen():
        try:
            answered = [a for a in session.answers]
            qs_with_answer = [
                q for q in session.questions
                if any(a.question_index == q.index for a in answered)
            ]
            answered_sorted = sorted(answered, key=lambda a: a.question_index)
            qs_sorted = sorted(qs_with_answer, key=lambda q: q.index)

            async for frag in stream_report(
                session_id=session_id,
                resume_text=resume_text,
                questions=qs_sorted,
                answers=answered_sorted,
            ):
                phase = frag["phase"]
                # Re-emit each fragment with a stable event name on the wire.
                yield _ndjson({"event": f"report:{phase}", "data": frag["data"]})
                if phase == "done":
                    # Persist the final report on the session.
                    current = store.get_session(session_id)
                    if current is not None:
                        from app.schemas.interview_session import InterviewReport
                        current.report = InterviewReport.model_validate(frag["data"])
                        current.status = "evaluated"
                        store.put_session(current)
        except Exception as exc:  # noqa: BLE001
            logger.exception("report generation failed")
            yield _ndjson({"event": "error", "message": str(exc)})

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str) -> None:
    if not store.delete_session(session_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
