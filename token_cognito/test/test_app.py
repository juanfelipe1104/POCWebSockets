import os
import pytest
import requests

from src.app import lambda_handler, fetch_cognito_token


@pytest.fixture(autouse=True)
def clear_env(monkeypatch):
    monkeypatch.delenv("URL_ACCESS_TOKEN", raising=False)


def test_lambda_missing_env_var():
    res = lambda_handler({"credentials": "AAA"}, None)
    assert res["code"] == 500
    assert "URL_ACCESS_TOKEN" in res["message"]


def test_lambda_missing_credentials(monkeypatch):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")
    res = lambda_handler({}, None)
    assert res["code"] == 400


def test_lambda_credentials_from_body_string(monkeypatch, requests_mock):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")
    requests_mock.post(
        "https://example.com/token",
        json={"access_token": "jwt123", "token_type": "Bearer", "expires_in": 3600},
        status_code=200,
    )

    res = lambda_handler({"body": '{"credentials":"BBB"}'}, None)
    assert res["code"] == 200
    assert res["data"]["token"] == "jwt123"


def test_lambda_success_direct(monkeypatch, requests_mock):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")
    requests_mock.post(
        "https://example.com/token",
        json={"access_token": "jwt_ok", "token_type": "Bearer", "expires_in": 3600},
        status_code=200,
    )

    res = lambda_handler({"credentials": "CCC"}, None)
    assert res["code"] == 200
    assert res["data"]["token"] == "jwt_ok"
    assert res["data"]["raw"]["access_token"] == "jwt_ok"


def test_fetch_cognito_token_adds_basic_prefix(monkeypatch, requests_mock):
    url = "https://example.com/token"
    adapter = requests_mock.post(
        url,
        json={"access_token": "jwt_ok", "token_type": "Bearer", "expires_in": 3600},
        status_code=200,
    )

    payload = fetch_cognito_token(url=url, credentials="XYZ")
    assert payload["access_token"] == "jwt_ok"
    # Verifica header enviado
    assert adapter.last_request.headers["Authorization"].startswith("Basic ")


def test_lambda_http_error_returns_401(monkeypatch, requests_mock):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")
    requests_mock.post(
        "https://example.com/token",
        json={"error": "invalid_client"},
        status_code=401,
    )

    res = lambda_handler({"credentials": "BAD"}, None)
    assert res["code"] == 401
    assert "HTTP 401" in res["message"]


def test_lambda_non_json_response_returns_502(monkeypatch, requests_mock):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")
    requests_mock.post(
        "https://example.com/token",
        text="not-json",
        status_code=200,
        headers={"Content-Type": "text/plain"},
    )

    res = lambda_handler({"credentials": "CCC"}, None)
    assert res["code"] == 502


def test_lambda_missing_access_token_returns_502(monkeypatch, requests_mock):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")
    requests_mock.post(
        "https://example.com/token",
        json={"token_type": "Bearer", "expires_in": 3600},
        status_code=200,
    )

    res = lambda_handler({"credentials": "CCC"}, None)
    assert res["code"] == 502
    assert "access_token" in res["message"]


def test_lambda_timeout_returns_504(monkeypatch, requests_mock):
    monkeypatch.setenv("URL_ACCESS_TOKEN", "https://example.com/token")

    def _raise_timeout(request, context):
        raise requests.Timeout("timeout")

    requests_mock.post("https://example.com/token", text=_raise_timeout)

    res = lambda_handler({"credentials": "CCC"}, None)
    assert res["code"] == 504
