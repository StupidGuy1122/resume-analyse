"""HMAC-signed session cookie auth.

Single-account model: username + password come from env. No registration UI.
Login issues a cookie ``ra_session=<expires>.<hmac>``; expires is a unix
timestamp; hmac is over ``"v1|<username>|<expires>"`` keyed by AUTH_SECRET.

Why HMAC cookies (not JWT, not server-side sessions):
  - No DB row per session needed; restart-safe naturally.
  - HMAC is enough — we have one user and we sign on the server.
  - JWT brings algorithm-confusion footguns we don't need for one user.
"""
from __future__ import annotations

import hmac
import secrets
import time
from hashlib import sha256

from app.config import get_settings

COOKIE_NAME = "ra_session"
_VERSION = "v1"


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), sha256).hexdigest()


def make_token(username: str) -> str:
    settings = get_settings()
    expires = int(time.time()) + settings.auth_session_days * 86400
    payload = f"{_VERSION}|{username}|{expires}"
    sig = _sign(payload, settings.auth_secret)
    return f"{expires}.{sig}"


def verify_token(token: str | None) -> bool:
    """Return True iff token is well-formed, current, and signed by our secret."""
    if not token or "." not in token:
        return False
    settings = get_settings()
    try:
        expires_str, sig = token.split(".", 1)
        expires = int(expires_str)
    except (ValueError, AttributeError):
        return False
    if expires < int(time.time()):
        return False
    payload = f"{_VERSION}|{settings.auth_username}|{expires}"
    expected = _sign(payload, settings.auth_secret)
    return hmac.compare_digest(sig, expected)


def check_credentials(username: str, password: str) -> bool:
    settings = get_settings()
    # constant-time compare on both fields
    u_ok = hmac.compare_digest(username.encode(), settings.auth_username.encode())
    p_ok = hmac.compare_digest(password.encode(), settings.auth_password.encode())
    return u_ok and p_ok


def cookie_max_age_seconds() -> int:
    return get_settings().auth_session_days * 86400


# Convenience: a unique salt per process to make logging / debugging tokens easier
_PROCESS_TAG = secrets.token_hex(4)


def process_tag() -> str:
    return _PROCESS_TAG
