"""Schemas describing resume-related payloads."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ResumeUploadResponse(BaseModel):
    """Returned after a successful upload."""

    resume_id: str = Field(..., description="UUID for fetching/analyzing this resume.")
    filename: str
    char_count: int
    preview: str = Field(..., description="First ~300 characters of the parsed text.")


class ParsedResume(BaseModel):
    """Internal representation stored in memory."""

    resume_id: str
    filename: str
    raw_text: str
    char_count: int


class ResumeDetail(BaseModel):
    """Full parsed text returned to client when requested."""

    resume_id: str
    filename: str
    raw_text: str
    char_count: int
