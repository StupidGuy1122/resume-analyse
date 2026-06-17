"""Pydantic models for the mock interview session feature.

Design notes:
  - All questions (and their pre-bound follow-ups) are generated upfront when
    the session starts, so per-answer latency only pays for the *evaluation* call.
  - `topic_summary` lets the question-generator avoid duplicates without needing
    embeddings — the model just reads the list of past summaries.
  - `Answer.score` / `feedback` are filled after the user submits, so the same
    object lives through "asked → answered → evaluated".
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Difficulty = Literal["junior", "mid", "senior"]
SessionStatus = Literal[
    "generating",   # questions still being produced
    "ready",        # all questions in hand, awaiting first answer
    "in_progress",  # at least one answer submitted
    "completed",    # all answered, awaiting final report
    "evaluated",    # report produced
]


class InterviewQuestion(BaseModel):
    index: int
    question: str
    topic_summary: str = Field(default="", description="≤10 字知识点摘要，用于历史去重")
    related_section: str = Field(default="", description="挂靠简历哪一部分")
    follow_ups: list[str] = Field(default_factory=list, description="预生成的追问")


class Answer(BaseModel):
    question_index: int
    user_answer: str
    score: int | None = None
    feedback: str | None = None
    reference_answer: str | None = None


class InterviewSession(BaseModel):
    session_id: str
    resume_id: str
    difficulty: Difficulty
    question_count: int
    status: SessionStatus = "generating"
    questions: list[InterviewQuestion] = Field(default_factory=list)
    answers: list[Answer] = Field(default_factory=list)
    current_index: int = 0
    report: InterviewReport | None = None


# ---- requests ----


class StartInterviewRequest(BaseModel):
    resume_id: str
    question_count: int = Field(default=5, ge=3, le=10)
    difficulty: Difficulty = "mid"


class SubmitAnswerRequest(BaseModel):
    question_index: int = Field(ge=0)
    user_answer: str = Field(min_length=1)


# ---- evaluation report ----


class CategoryScore(BaseModel):
    category: str
    score: int
    question_count: int


class InterviewReport(BaseModel):
    session_id: str
    overall_score: int
    overall_feedback: str = ""
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    category_scores: list[CategoryScore] = Field(default_factory=list)


# Forward-ref resolution (InterviewSession references InterviewReport).
InterviewSession.model_rebuild()
