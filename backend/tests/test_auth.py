"""Auth smoke tests."""
from __future__ import annotations

from app.services.auth import (
    check_credentials,
    make_token,
    verify_token,
)


def test_correct_credentials_pass():
    # defaults from config: admin / admin
    assert check_credentials("admin", "admin")


def test_wrong_credentials_fail():
    assert not check_credentials("admin", "wrong")
    assert not check_credentials("hacker", "admin")
    assert not check_credentials("", "")


def test_token_round_trip():
    token = make_token("admin")
    assert verify_token(token)


def test_tampered_token_rejected():
    token = make_token("admin")
    # Flip a hex char in the signature
    bad = token[:-1] + ("0" if token[-1] != "0" else "1")
    assert not verify_token(bad)


def test_malformed_token_rejected():
    assert not verify_token(None)
    assert not verify_token("")
    assert not verify_token("nope")
    assert not verify_token("123.")


def test_expired_token_rejected(monkeypatch):
    """Inject a past-expiry token directly and confirm rejection."""
    import hmac
    import time
    from hashlib import sha256
    from app.config import get_settings
    s = get_settings()
    expires = int(time.time()) - 1000
    payload = f"v1|{s.auth_username}|{expires}"
    sig = hmac.new(s.auth_secret.encode(), payload.encode(), sha256).hexdigest()
    expired = f"{expires}.{sig}"
    assert not verify_token(expired)
