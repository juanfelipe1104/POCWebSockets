import os
import time

import jwt
import pytest

from src.app import (
    BadRequest,
    ConfigError,
    _extract_token,
    handler,
    validate_token,
)


@pytest.fixture(autouse=True)
def jwt_key_env(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "super-secret-key")
    yield


def _make_token(key: str, payload: dict, alg: str = "HS256") -> str:
    t = jwt.encode(payload, key, algorithm=alg)
    return t.decode("utf-8") if isinstance(t, bytes) else t


def test_extract_token_ok():
    assert _extract_token({"data": "abc"}) == "abc"


@pytest.mark.parametrize("event", [{}, {"data": ""}, {"data": "   "}, {"data": 123}, {"data": None}])
def test_extract_token_bad_request(event):
    with pytest.raises(BadRequest):
        _extract_token(event)


def test_validate_token_ok_roundtrip(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "k")
    now = int(time.time())
    payload = {"sub": "u1", "iat": now, "exp": now + 60}
    token = _make_token("k", payload)

    out = validate_token(token)
    assert out["sub"] == "u1"
    assert out["iat"] == now
    assert out["exp"] == now + 60


def test_validate_token_expired(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "k")
    now = int(time.time())
    payload = {"sub": "u1", "iat": now - 120, "exp": now - 60}
    token = _make_token("k", payload)

    with pytest.raises(jwt.ExpiredSignatureError):
        validate_token(token)


def test_validate_token_invalid_signature(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "k-right")
    now = int(time.time())
    payload = {"sub": "u1", "iat": now, "exp": now + 60}
    token = _make_token("k-wrong", payload)  # firmado con otra key

    with pytest.raises(jwt.InvalidTokenError):
        validate_token(token)


def test_handler_success_returns_payload():
    now = int(time.time())
    payload = {"sub": "u1", "iat": now, "exp": now + 60, "custom": "x"}
    token = _make_token("super-secret-key", payload)

    resp = handler({"data": token}, None)
    assert resp["code"] == 200
    assert resp["data"]["sub"] == "u1"
    assert resp["data"]["custom"] == "x"


def test_handler_expired_returns_401():
    now = int(time.time())
    payload = {"sub": "u1", "iat": now - 120, "exp": now - 1}
    token = _make_token("super-secret-key", payload)

    resp = handler({"data": token}, None)
    assert resp["code"] == 401
    assert "expired" in resp["message"].lower()


def test_handler_invalid_signature_returns_401():
    now = int(time.time())
    payload = {"sub": "u1", "iat": now, "exp": now + 60}
    token = _make_token("different-key", payload)

    resp = handler({"data": token}, None)
    assert resp["code"] == 401
    assert resp["message"]


def test_handler_missing_data_returns_401():
    resp = handler({}, None)
    assert resp["code"] == 401
    assert resp["message"]


def test_handler_empty_token_returns_401():
    resp = handler({"data": "   "}, None)
    assert resp["code"] == 401
    assert resp["message"]


def test_handler_missing_env_key_returns_401(monkeypatch):
    monkeypatch.delenv("JWT_KEY", raising=False)

    # token cualquiera (da igual, fallará por config)
    resp = handler({"data": "abc.def.ghi"}, None)
    assert resp["code"] == 401
    assert "jwt_key" in resp["message"].lower()
