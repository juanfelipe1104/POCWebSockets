import os
import json

import boto3
import pytest
from botocore.stub import Stubber
from botocore.exceptions import ClientError

import lambda_function as lf


@pytest.fixture(autouse=True)
def _set_env(monkeypatch):
    monkeypatch.setenv("WEBSOCKET_API_ENDPOINT", "https://example.execute-api.eu-west-1.amazonaws.com/prod")
    # refrescar el módulo-level var (ya que se lee en import)
    lf.WEBSOCKET_API_ENDPOINT = os.getenv("WEBSOCKET_API_ENDPOINT")


def _make_stubbed_client(monkeypatch):
    client = boto3.client("apigatewaymanagementapi", endpoint_url=os.getenv("WEBSOCKET_API_ENDPOINT"))
    stubber = Stubber(client)

    def _factory(endpoint_url: str):
        return client

    monkeypatch.setattr(lf, "_make_apigwmgmt_client", _factory)
    return client, stubber


def test_success_sends_dict_as_json_bytes(monkeypatch):
    client, stubber = _make_stubbed_client(monkeypatch)

    event = {"connectionId": "abc123", "data": {"hello": "world", "n": 1}}
    expected_bytes = json.dumps(event["data"], separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    stubber.add_response(
        "post_to_connection",
        service_response={},  # la API suele devolver vacío
        expected_params={"ConnectionId": "abc123", "Data": expected_bytes},
    )

    with stubber:
        resp = lf.lambda_handler(event, None)

    assert resp["statusCode"] == 200
    assert resp["sent"] is True


def test_success_sends_string_as_utf8(monkeypatch):
    client, stubber = _make_stubbed_client(monkeypatch)

    event = {"connectionId": "c1", "data": "hola"}
    stubber.add_response(
        "post_to_connection",
        service_response={},
        expected_params={"ConnectionId": "c1", "Data": b"hola"},
    )

    with stubber:
        resp = lf.lambda_handler(event, None)

    assert resp["statusCode"] == 200
    assert resp["sent"] is True


def test_missing_connection_id_returns_400():
    resp = lf.lambda_handler({"data": {"x": 1}}, None)
    assert resp["statusCode"] == 400
    assert resp["sent"] is False


def test_missing_endpoint_returns_500(monkeypatch):
    monkeypatch.delenv("WEBSOCKET_API_ENDPOINT", raising=False)
    lf.WEBSOCKET_API_ENDPOINT = None

    resp = lf.lambda_handler({"connectionId": "c1", "data": "x"}, None)
    assert resp["statusCode"] == 500
    assert resp["sent"] is False


def test_gone_exception_returns_410(monkeypatch):
    client, stubber = _make_stubbed_client(monkeypatch)

    event = {"connectionId": "gone123", "data": {"a": 1}}
    expected_bytes = json.dumps(event["data"], separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    gone_error = ClientError(
        error_response={
            "Error": {"Code": "GoneException", "Message": "Gone"},
            "ResponseMetadata": {"HTTPStatusCode": 410},
        },
        operation_name="PostToConnection",
    )

    stubber.add_client_error(
        "post_to_connection",
        service_error_code="GoneException",
        service_message="Gone",
        http_status_code=410,
        expected_params={"ConnectionId": "gone123", "Data": expected_bytes},
    )

    with stubber:
        resp = lf.lambda_handler(event, None)

    assert resp["statusCode"] == 410
    assert resp["sent"] is False
    assert resp["error"] == "GONE"


def test_non_gone_client_error_returns_500(monkeypatch):
    client, stubber = _make_stubbed_client(monkeypatch)

    event = {"connectionId": "c1", "data": "x"}

    stubber.add_client_error(
        "post_to_connection",
        service_error_code="ForbiddenException",
        service_message="Forbidden",
        http_status_code=403,
        expected_params={"ConnectionId": "c1", "Data": b"x"},
    )

    with stubber:
        resp = lf.lambda_handler(event, None)

    assert resp["statusCode"] == 500
    assert resp["sent"] is False
    assert resp["error"].startswith("ClientError:")