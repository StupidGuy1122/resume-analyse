"""Process-local in-memory storage for parsed resumes and analysis cache.

MVP only — replace with PostgreSQL/Redis when persistence is needed.
"""
from __future__ import annotations

from threading import RLock
from typing import Any

from app.schemas.resume import ParsedResume


class _Store:
    """Thread-safe dict wrapper. Single source of truth for resumes & analyses."""

    def __init__(self) -> None:
        self._resumes: dict[str, ParsedResume] = {}
        self._analyses: dict[str, dict[str, Any]] = {}  # resume_id -> {kind: result}
        self._lock = RLock()

    # ---- resumes ----
    def put_resume(self, resume: ParsedResume) -> None:
        with self._lock:
            self._resumes[resume.resume_id] = resume

    def get_resume(self, resume_id: str) -> ParsedResume | None:
        with self._lock:
            return self._resumes.get(resume_id)

    # ---- analysis cache ----
    def put_analysis(self, resume_id: str, kind: str, result: Any) -> None:
        with self._lock:
            self._analyses.setdefault(resume_id, {})[kind] = result

    def get_analysis(self, resume_id: str, kind: str) -> Any | None:
        with self._lock:
            return self._analyses.get(resume_id, {}).get(kind)


# Module-level singleton — FastAPI dependency-inject this.
store = _Store()
