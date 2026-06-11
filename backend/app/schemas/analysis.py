"""Schemas describing analysis results returned by the Agent."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high"]
Difficulty = Literal["easy", "medium", "hard"]


class SuggestionItem(BaseModel):
    section: str = Field(..., description="Resume section the suggestion targets, e.g. 'work_experience'.")
    original: str = Field(..., description="Snippet from the resume that should be revised.")
    suggestion: str = Field(..., description="Proposed rewrite or improvement.")
    reason: str = Field(..., description="Why this change helps (e.g. quantification, ATS-friendly verb).")
    priority: Priority = "medium"


class InterviewQuestion(BaseModel):
    question: str
    difficulty: Difficulty = "medium"
    related_section: str = Field(..., description="Which part of the resume this question probes.")
    hint: str = Field("", description="Optional hint or expected answer outline.")


class SuggestionsResult(BaseModel):
    resume_id: str
    items: list[SuggestionItem]


class InterviewQuestionsResult(BaseModel):
    resume_id: str
    items: list[InterviewQuestion]
