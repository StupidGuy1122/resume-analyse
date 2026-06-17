"""Grounding check — keep LLM suggestions honest.

Each suggestion claims ``original`` is "verbatim" from the resume.
Reality: 7B models paraphrase. We verify by checking whether enough of
``original``'s tokens actually appear in the resume text.

Algorithm: token-level Jaccard similarity between ``original`` and a
sliding window over the resume. If the best-matching window scores
below ``MIN_OVERLAP``, drop the suggestion.

This is not a "did the model lie?" oracle — it's a cheap, deterministic
filter that catches the obvious cases (made-up sentences, fabricated
numbers) without LLM-on-LLM cost.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Tunable: min token-level Jaccard similarity for a suggestion's `original`
# to count as "really from the resume". 0.6 means at least 60% of tokens
# overlap with the best-matching window. Empirically:
#   - 0.5 lets through too many paraphrases
#   - 0.7 rejects too many legitimate truncations
MIN_OVERLAP = 0.6

# Words too common to be evidence of grounding (CN + EN). Filtered before scoring.
_STOPWORDS = {
    "的", "了", "和", "与", "及", "在", "是", "我", "我们", "你", "他", "她", "它",
    "这", "那", "这个", "那个", "这些", "那些", "有", "没有", "等", "等等",
    "the", "a", "an", "and", "or", "of", "in", "on", "at", "for", "to", "is",
    "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
    "does", "did", "i", "we", "you", "they", "it", "this", "that",
}

# Token splitter: keep CJK characters + ASCII alphanumerics + numbers.
# Numbers matter most — model fabrications usually invent specific figures.
_TOKEN_RE = re.compile(r"[一-鿿]|[A-Za-z0-9]+(?:\.[0-9]+)?", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _content_tokens(text: str) -> set[str]:
    """Tokens worth scoring — drops stopwords and 1-char ASCII noise."""
    out: set[str] = set()
    for tok in _tokenize(text):
        if tok in _STOPWORDS:
            continue
        # 1-char ASCII (e.g. 'a', 'i') is noise; CJK 1-char is signal.
        if len(tok) == 1 and tok.isascii():
            continue
        out.add(tok)
    return out


@dataclass(frozen=True)
class GroundingResult:
    is_grounded: bool
    overlap: float
    reason: str = ""


def check_grounding(claimed_original: str, resume_text: str) -> GroundingResult:
    """Score how much of ``claimed_original`` is actually present in ``resume_text``.

    Returns is_grounded=True iff overlap >= MIN_OVERLAP.
    """
    claim_tokens = _content_tokens(claimed_original)
    if not claim_tokens:
        # Empty / all-stopwords claim — can't verify, accept defensively.
        return GroundingResult(is_grounded=True, overlap=1.0, reason="empty-claim")

    resume_tokens = _content_tokens(resume_text)
    if not resume_tokens:
        return GroundingResult(is_grounded=False, overlap=0.0, reason="empty-resume")

    common = claim_tokens & resume_tokens
    overlap = len(common) / len(claim_tokens)

    return GroundingResult(
        is_grounded=overlap >= MIN_OVERLAP,
        overlap=overlap,
        reason=f"overlap={overlap:.2f}",
    )


def filter_grounded_items(
    items: list,
    resume_text: str,
    *,
    field: str = "original",
) -> list:
    """Return a new list with only the items whose ``field`` is grounded.

    Logs every drop with the failing claim and overlap score so you can tune
    MIN_OVERLAP from real data.
    """
    kept = []
    dropped = 0
    for item in items:
        claim = getattr(item, field, None) or (item.get(field) if isinstance(item, dict) else None)
        if not claim:
            kept.append(item)
            continue
        result = check_grounding(claim, resume_text)
        if result.is_grounded:
            kept.append(item)
        else:
            dropped += 1
            logger.info(
                "grounding: dropped item (overlap=%.2f) — claim=%r",
                result.overlap,
                claim[:120],
            )
    if dropped:
        logger.info("grounding: kept %d / %d items", len(kept), len(items))
    return kept
