"""Tests for the interview agent: question streaming, answer evaluation, report."""
from __future__ import annotations

import pytest

from app.agent import interview_agent
from app.schemas.interview_session import Answer, InterviewQuestion


class FakeOllama:
    def __init__(self, json_responses=None, stream_chunks=None):
        self._json = list(json_responses or [])
        self._chunks = list(stream_chunks or [])
        self.calls = 0

    async def chat_json(self, system, user, *, temperature=0.2):  # noqa: ARG002
        self.calls += 1
        if not self._json:
            raise AssertionError("No more canned chat_json responses")
        return self._json.pop(0)

    async def chat_json_stream(self, system, user, *, temperature=0.2):  # noqa: ARG002
        for c in self._chunks:
            yield c


@pytest.mark.asyncio
async def test_stream_questions_emits_validated_objects():
    cumulative = [
        '{"items":[{"question":"q1","topic_summary":"t1","related_section":"work_experience","follow_ups":["f1","f2"]}',
        ',{"question":"q2","topic_summary":"t2","related_section":"projects","follow_ups":["a","b"]}]}',
    ]
    acc, bufs = "", []
    for c in cumulative:
        acc += c
        bufs.append(acc)
    fake = FakeOllama(stream_chunks=bufs)

    out = []
    async for q in interview_agent.stream_questions(
        resume_text="Resume text here",
        question_count=2,
        difficulty="mid",
        client=fake,  # type: ignore[arg-type]
    ):
        out.append(q)

    assert len(out) == 2
    assert isinstance(out[0], InterviewQuestion)
    assert out[0].index == 0
    assert out[1].index == 1
    assert out[0].follow_ups == ["f1", "f2"]


@pytest.mark.asyncio
async def test_evaluate_answer_clamps_score_and_strips_text():
    fake = FakeOllama(json_responses=[{
        "score": "150",  # out of range, must be clamped
        "feedback": "  good points  ",
        "reference_answer": "  ref text  ",
    }])
    q = InterviewQuestion(index=0, question="q", topic_summary="t",
                          related_section="work_experience", follow_ups=[])
    a = await interview_agent.evaluate_answer(q, "my answer", client=fake)  # type: ignore[arg-type]
    assert a.score == 100
    assert a.feedback == "good points"
    assert a.reference_answer == "ref text"


@pytest.mark.asyncio
async def test_evaluate_answer_zero_for_giveup():
    """Giveup phrases must score 0 — pass through whatever the model returns,
    but make sure non-numeric/missing scores don't crash."""
    fake = FakeOllama(json_responses=[{
        "score": None,
        "feedback": "答案为'不知道'，未提供有效内容",
        "reference_answer": "...",
    }])
    q = InterviewQuestion(index=0, question="q", topic_summary="t",
                          related_section="skills", follow_ups=[])
    a = await interview_agent.evaluate_answer(q, "不知道", client=fake)  # type: ignore[arg-type]
    assert a.score == 0


@pytest.mark.asyncio
async def test_stream_report_emits_phases_in_order():
    fake = FakeOllama(json_responses=[{
        "overall_score": 78,
        "overall_feedback": "整体不错。",
        "strengths": ["技术功底扎实", "表达清晰"],
        "improvements": ["对底层原理理解不够深入"],
        "category_scores": [
            {"category": "数据库", "score": 80, "question_count": 2},
            {"category": "分布式", "score": 75, "question_count": 1},
        ],
    }])

    q = InterviewQuestion(index=0, question="q", topic_summary="t",
                          related_section="work_experience", follow_ups=[])
    a = Answer(question_index=0, user_answer="ans", score=80, feedback="ok",
               reference_answer="ref")

    phases = []
    async for frag in interview_agent.stream_report(
        session_id="sid", resume_text="resume", questions=[q], answers=[a], client=fake,  # type: ignore[arg-type]
    ):
        phases.append(frag["phase"])

    # Must start with overall, end with done; have exactly 2 strengths,
    # 1 improvement, 2 categories.
    assert phases[0] == "overall"
    assert phases[-1] == "done"
    assert phases.count("strength") == 2
    assert phases.count("improvement") == 1
    assert phases.count("category") == 2
