"""Persistence layer — SQLite-backed store for resumes, analyses, and sessions.

Design notes:
  - One file: ``data/app.db`` (path configurable via ``DB_PATH`` env var).
  - Three tables: ``resumes`` / ``analyses`` / ``interview_sessions``.
  - We store full Pydantic models as JSON in a TEXT column. SQLite is fast enough
    for single-user local desktop usage and removes the need for a migration
    framework.
  - Keeps the in-memory ``store.put_resume(...)`` API surface intact, so callers
    don't change.
  - Uses thread-local connections (``check_same_thread=False`` + a single shared
    connection guarded by ``RLock``) — uvicorn's worker model only needs one DB
    handle.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from threading import RLock
from typing import Any

from app.config import get_settings
from app.schemas.interview_session import InterviewSession
from app.schemas.resume import ParsedResume

_SCHEMA = """
CREATE TABLE IF NOT EXISTS resumes (
    resume_id  TEXT PRIMARY KEY,
    payload    TEXT NOT NULL,                 -- JSON of ParsedResume
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS analyses (
    resume_id  TEXT NOT NULL,
    kind       TEXT NOT NULL,                 -- 'suggestions' | 'interview'
    payload    TEXT NOT NULL,                 -- JSON of result model
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (resume_id, kind),
    FOREIGN KEY (resume_id) REFERENCES resumes(resume_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    session_id TEXT PRIMARY KEY,
    resume_id  TEXT NOT NULL,
    payload    TEXT NOT NULL,                 -- JSON of InterviewSession
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (resume_id) REFERENCES resumes(resume_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_resume ON interview_sessions(resume_id);
"""


class _Store:
    """SQLite-backed store. Same surface as the old in-memory dict store."""

    def __init__(self, db_path: str | None = None) -> None:
        path = db_path or get_settings().db_path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        self._conn.executescript(_SCHEMA)
        self._lock = RLock()

    # ---- resumes ----
    def put_resume(self, resume: ParsedResume) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO resumes (resume_id, payload) VALUES (?, ?)",
                (resume.resume_id, resume.model_dump_json()),
            )

    def get_resume(self, resume_id: str) -> ParsedResume | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT payload FROM resumes WHERE resume_id = ?",
                (resume_id,),
            ).fetchone()
        if row is None:
            return None
        return ParsedResume.model_validate_json(row["payload"])

    def list_resumes(self) -> list[ParsedResume]:
        """Used by the dashboard / login landing page to show recent uploads."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT payload FROM resumes ORDER BY created_at DESC LIMIT 50"
            ).fetchall()
        return [ParsedResume.model_validate_json(r["payload"]) for r in rows]

    # ---- analysis cache ----
    def put_analysis(self, resume_id: str, kind: str, result: Any) -> None:
        # Result is a Pydantic model — serialize via its model_dump_json if available.
        if hasattr(result, "model_dump_json"):
            payload = result.model_dump_json()
        else:
            payload = json.dumps(result, ensure_ascii=False)
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO analyses (resume_id, kind, payload) VALUES (?, ?, ?)",
                (resume_id, kind, payload),
            )

    def get_analysis(self, resume_id: str, kind: str) -> Any | None:
        """Return the raw Pydantic object the caller stored.

        We can't reconstruct the typed object without knowing the class, so we
        return a parsed dict — callers historically only used this for cache
        hit-detection (``is None``) followed by a re-serialise, so dict is fine.
        For typed reads, fetch through the dedicated typed API methods.
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT payload FROM analyses WHERE resume_id = ? AND kind = ?",
                (resume_id, kind),
            ).fetchone()
        if row is None:
            return None
        return json.loads(row["payload"])

    # ---- interview sessions ----
    def put_session(self, session: InterviewSession) -> None:
        with self._lock:
            self._conn.execute(
                """INSERT INTO interview_sessions (session_id, resume_id, payload, updated_at)
                   VALUES (?, ?, ?, strftime('%s','now'))
                   ON CONFLICT(session_id) DO UPDATE SET
                     payload = excluded.payload,
                     updated_at = strftime('%s','now')""",
                (session.session_id, session.resume_id, session.model_dump_json()),
            )

    def get_session(self, session_id: str) -> InterviewSession | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT payload FROM interview_sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return InterviewSession.model_validate_json(row["payload"])

    def delete_session(self, session_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM interview_sessions WHERE session_id = ?",
                (session_id,),
            )
        return cur.rowcount > 0

    def list_sessions_for_resume(self, resume_id: str) -> list[InterviewSession]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT payload FROM interview_sessions WHERE resume_id = ? ORDER BY updated_at DESC",
                (resume_id,),
            ).fetchall()
        return [InterviewSession.model_validate_json(r["payload"]) for r in rows]


# Module-level singleton. FastAPI dependency-inject this.
store = _Store()
