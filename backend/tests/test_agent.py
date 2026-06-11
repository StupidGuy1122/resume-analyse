"""Tests for the Agent pipeline using a mock Ollama client."""
from __future__ import annotations

from typing import Any

import pytest

from app.agent import pipeline
from app.agent.schemas import StructuredResume


class FakeOllama:
    """Programmable async Ollama stub. Returns canned JSON dicts in order."""

    def __init__(self, responses: list[dict[str, Any]]):
        self._responses = list(responses)
        self.calls: list[tuple[str, str]] = []

    async def chat_json(self, system: str, user: str, *, temperature: float = 0.2):  # noqa: ARG002
        self.calls.append((system[:40], user[:40]))
        if not self._responses:
            raise AssertionError("No more canned responses")
        return self._responses.pop(0)


@pytest.mark.asyncio
async def test_extract_structured_returns_typed_object():
    fake = FakeOllama(
        [
            {
                "name": "Jane Doe",
                "contact": {"email": "jane@example.com"},
                "summary": "Engineer",
                "education": [],
                "work_experience": [{"company": "Acme", "title": "SWE", "start": "", "end": "", "bullets": []}],
                "projects": [],
                "skills": ["python"],
            }
        ]
    )
    out = await pipeline.extract_structured("resume text", client=fake)  # type: ignore[arg-type]
    assert isinstance(out, StructuredResume)
    assert out.name == "Jane Doe"
    assert out.skills == ["python"]


@pytest.mark.asyncio
async def test_analyze_suggestions_filters_invalid_items():
    fake = FakeOllama(
        [
            {
                "items": [
                    {
                        "section": "summary",
                        "original": "Did stuff",
                        "suggestion": "Led 4-person team to ship X",
                        "reason": "Quantify impact",
                        "priority": "high",
                    },
                    {"section": "summary"},  # invalid — should be dropped
                ]
            }
        ]
    )
    structured = StructuredResume(name="Jane")
    res = await pipeline.analyze_suggestions("rid-1", "raw text", structured, client=fake)  # type: ignore[arg-type]
    assert res.resume_id == "rid-1"
    assert len(res.items) == 1
    assert res.items[0].priority == "high"


@pytest.mark.asyncio
async def test_analyze_interview_questions_handles_bare_list():
    fake = FakeOllama(
        [
            [  # Some models return a bare list — we must still cope.
                {
                    "question": "Tell me about Acme",
                    "difficulty": "medium",
                    "related_section": "work_experience",
                    "hint": "Talk about scope",
                }
            ]
        ]
    )
    structured = StructuredResume(name="Jane")
    res = await pipeline.analyze_interview_questions("rid-2", structured, client=fake)  # type: ignore[arg-type]
    assert len(res.items) == 1
    assert res.items[0].difficulty == "medium"


@pytest.mark.asyncio
async def test_retry_on_invalid_json_then_success():
    """First call fails parsing, second call succeeds — pipeline should recover."""

    class FlakyOllama:
        def __init__(self):
            self.attempts = 0

        async def chat_json(self, system: str, user: str, *, temperature: float = 0.2):  # noqa: ARG002
            self.attempts += 1
            if self.attempts == 1:
                raise ValueError("not json")
            return {"name": "Jane", "education": [], "work_experience": [], "projects": [], "skills": []}

    flaky = FlakyOllama()
    out = await pipeline.extract_structured("resume", client=flaky)  # type: ignore[arg-type]
    assert flaky.attempts == 2
    assert out.name == "Jane"
