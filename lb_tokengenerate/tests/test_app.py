import time

import jwt
import pytest

from src.app import (
    BadRequest,
    ConfigError,
    _coerce_ttl_seconds,
    _extract_claims,
    create_token,
    handler,
)


@pytest.fixture(autouse=True)
def jwt_key_env(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "super-secret-key")
    yield


def test_coerce_ttl_default():
    assert _coerce_ttl_seconds(None, 123) == 123


@pytest.mark.parametrize("v", ["abc", 1.2, {}, []])
def test_coerce_ttl_invalid_type(v):
    with pytest.raises(BadRequest):
        _coerce_ttl_seconds(v)


@pytest.mark.parametrize("v", [0, -1, "-10"])
def test_coerce_ttl_non_positive(v):
    with pytest.raises(BadRequest):
        _coerce_ttl_seconds(v)


def test_coerce_ttl_too_large():
    with pytest.raises(BadRequest):
        _coerce_ttl_seconds(86401)


def test_extract_claims_ok_default_ttl():
    claims, ttl = _extract_claims({"data": {"a": 1}})
    assert claims == {"a": 1}
    assert ttl == 15 * 60


def test_extract_claims_ok_custom_ttl():
    claims, ttl = _extract_claims({"data": {"a": 1}, "ttl_seconds": 60})
    assert claims == {"a": 1}
    assert ttl == 60


def test_extract_claims_missing_data():
    with pytest.raises(BadRequest):
        _extract_claims({"nope": 1})


def test_extract_claims_data_not_object():
    with pytest.raises(BadRequest):
        _extract_claims({"data": ["x"]})


def test_create_token_includes_iat_exp(monkeypatch):
    monkeypatch.setenv("JWT_KEY", "k")
    now = 1700000000
    token, payload = create_token(claims={"role": "admin"}, ttl_seconds=60, now=now)

    assert payload["role"] == "admin"
    assert payload["iat"] == now
    assert payload["exp"] == now + 60

    decoded = jwt.decode(token, "k", algorithms=["HS256"])
    assert decoded["role"] == "admin"
    assert decoded["iat"] == now
    assert decoded["exp"] == now + 60


def test_create_token_missing_env_key(monkeypatch):
    monkeypatch.delenv("JWT_KEY", raising=False)
    with pytest.raises(ConfigError):
        create_token(claims={"a": 1})


def test_handler_success_default_ttl():
    resp = handler({"data": {"sub": "user-123", "scope": "read"}}, None)
    assert resp["code"] == 200
    assert "data" in resp
    data = resp["data"]
    assert "token" in data
    assert data["token_type"] == "Bearer"
    assert data["expires_in"] == 15 * 60
    assert isinstance(data["expires_at"], int)

    decoded = jwt.decode(data["token"], "super-secret-key", algorithms=["HS256"])
    assert decoded["sub"] == "user-123"
    assert decoded["scope"] == "read"


def test_handler_success_custom_ttl():
    resp = handler({"data": {"x": "y"}, "ttl_seconds": 120}, None)
    assert resp["code"] == 200
    assert resp["data"]["expires_in"] == 120

    decoded = jwt.decode(resp["data"]["token"], "super-secret-key", algorithms=["HS256"])
    assert decoded["x"] == "y"


def test_handler_bad_request_missing_data():
    resp = handler({"x": 1}, None)
    assert resp["code"] == 400
    assert resp["error"] == "BAD_REQUEST"


def test_handler_bad_request_data_wrong_type():
    resp = handler({"data": ["x"]}, None)
    assert resp["code"] == 400
    assert resp["error"] == "BAD_REQUEST"


def test_handler_config_error_missing_key(monkeypatch):
    monkeypatch.delenv("JWT_KEY", raising=False)
    resp = handler({"data": {"a": 1}}, None)
    assert resp["code"] == 500
    assert resp["error"] == "CONFIG_ERROR"


def test_handler_expiration_is_in_future():
    before = int(time.time())
    resp = handler({"data": {"a": 1}, "ttl_seconds": 30}, None)
    assert resp["code"] == 200
    decoded = jwt.decode(resp["data"]["token"], "super-secret-key", algorithms=["HS256"])
    assert decoded["iat"] >= before
    assert decoded["exp"] >= before + 30
    assert resp["data"]["expires_at"] == decoded["exp"]
