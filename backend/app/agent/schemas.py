"""Internal data structures used by the Agent pipeline."""
from __future__ import annotations

from pydantic import BaseModel, Field


class StructuredResume(BaseModel):
    """Structured form produced by the first pipeline step (LLM extraction)."""

    name: str = ""
    contact: dict[str, str] = Field(default_factory=dict)
    summary: str = ""
    education: list[dict] = Field(default_factory=list)
    work_experience: list[dict] = Field(default_factory=list)
    projects: list[dict] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
