"""Tests for the token-overlap grounding check."""
from __future__ import annotations

from app.services.grounding import check_grounding, filter_grounded_items


def test_verbatim_quote_is_grounded():
    resume = "负责订单系统重构，QPS 从 2k 提升到 8k。"
    assert check_grounding("负责订单系统重构，QPS 从 2k 提升到 8k", resume).is_grounded


def test_unrelated_text_is_rejected():
    resume = "负责订单系统重构，QPS 从 2k 提升到 8k。"
    assert not check_grounding("领导团队完成 Kubernetes 集群的多云迁移项目", resume).is_grounded


def test_fabricated_numbers_in_real_sentence_NOT_caught():
    """Document grounding's real limit: it cannot catch numbers fabricated
    inside an otherwise verbatim sentence (token overlap stays high).

    This case is the prompt's job — see SUGGESTIONS_SYSTEM rule 2 and
    the BAD example. A future LLM-critic step (task D) is the real fix.
    """
    resume = "用 Go 重写支付链路，p99 延迟下降 40%"
    fabricated = "用 Go 重写支付链路，将 p99 延迟从 150ms 降至 90ms"
    # Grounding alone passes this — calling it out so future readers don't
    # assume token-overlap catches all hallucinations.
    assert check_grounding(fabricated, resume).is_grounded


def test_fabricated_sentence_caught():
    """Wholesale-invented sentences ARE caught — that's grounding's job."""
    resume = "用 Go 重写支付链路，p99 延迟下降 40%"
    invented = "Led 4 engineers to redesign the entire trading platform from scratch"
    assert not check_grounding(invented, resume).is_grounded


def test_partial_overlap_still_rejects_paraphrase():
    resume = "用 Python/Django 开发用户中心"
    paraphrase = "利用 Python 和 Django 框架开发了一套完整的用户中心系统并支持高并发"
    # Some shared tokens (python/django/用户中心) but lots of new ones added.
    res = check_grounding(paraphrase, resume)
    assert not res.is_grounded


def test_filter_drops_ungrounded_dict_items():
    resume = "Built a thing. Shipped on time."
    items = [
        {"original": "Built a thing", "suggestion": "..."},
        {"original": "Single-handedly delivered a $50M product line", "suggestion": "..."},
    ]
    kept = filter_grounded_items(items, resume, field="original")
    assert len(kept) == 1
    assert kept[0]["original"] == "Built a thing"


def test_filter_keeps_items_with_no_claim_field():
    resume = "anything"
    items = [{"foo": "bar"}]   # no `original` to check → defensively kept
    kept = filter_grounded_items(items, resume, field="original")
    assert len(kept) == 1
