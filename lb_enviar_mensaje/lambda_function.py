import json
import os
from typing import Any, Dict, Optional, Union

import boto3
from botocore.exceptions import ClientError

# Env var esperada:
# WEBSOCKET_API_ENDPOINT = "https://{api-id}.execute-api.{region}.amazonaws.com/{stage}"
WEBSOCKET_API_ENDPOINT = os.getenv("WEBSOCKET_API_ENDPOINT")


def _make_apigwmgmt_client(endpoint_url: str):
    # apiGatewayManagementApi requiere endpoint_url explícito
    return boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)


def _serialize_data(data: Any) -> bytes:
    """
    Convierte `data` a bytes para post_to_connection.
    - dict/list/obj -> JSON bytes
    - str -> UTF-8 bytes
    - bytes/bytearray -> bytes
    - None -> b""
    - otros -> str(...) bytes
    """
    if data is None:
        return b""
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    if isinstance(data, str):
        return data.encode("utf-8")
    if isinstance(data, (dict, list, int, float, bool)):
        return json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return str(data).encode("utf-8")


def _extract(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Entrada esperada desde Step Functions:
      { "connectionId": "...", "data": ... }

    También soporta variantes:
      connectionID (D mayúscula) o payload anidado en "input"/"Payload".
    """
    if not isinstance(event, dict):
        raise ValueError("Event must be a JSON object")

    # A veces SFN pasa cosas anidadas
    candidate = event
    for key in ("input", "Input", "payload", "Payload"):
        if key in candidate and isinstance(candidate[key], dict):
            candidate = candidate[key]

    connection_id = (
        candidate.get("connectionId")
        or candidate.get("connectionID")
        or candidate.get("connection_id")
    )
    if not connection_id or not isinstance(connection_id, str):
        raise ValueError("Missing or invalid 'connectionId'")

    data = candidate.get("data")
    return {"connectionId": connection_id, "data": data}


def lambda_handler(event: Dict[str, Any], context: Optional[Any] = None) -> Dict[str, Any]:
    """
    Envía `data` al WebSocket del cliente identificado por `connectionId`.

    Returns (para Step Functions):
      - {"statusCode": 200, "sent": true}
      - {"statusCode": 410, "sent": false, "error": "GONE"}  # conexión ya no existe
      - {"statusCode": 500, "sent": false, "error": "..."}  # fallo técnico
    """
    if not WEBSOCKET_API_ENDPOINT:
        return {"statusCode": 500, "sent": False, "error": "Missing WEBSOCKET_API_ENDPOINT"}

    try:
        payload = _extract(event)
        connection_id = payload["connectionId"]
        data = payload["data"]
    except ValueError as e:
        return {"statusCode": 400, "sent": False, "error": str(e)}

    client = _make_apigwmgmt_client(WEBSOCKET_API_ENDPOINT)
    message_bytes = _serialize_data(data)

    try:
        client.post_to_connection(ConnectionId=connection_id, Data=message_bytes)
        return {"statusCode": 200, "sent": True}
    except ClientError as e:
        # Si el cliente ya cerró la conexión, API Gateway devuelve 410 Gone
        status = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        code = e.response.get("Error", {}).get("Code")

        if status == 410 or code in ("GoneException", "Gone"):
            return {"statusCode": 410, "sent": False, "error": "GONE"}

        return {
            "statusCode": 500,
            "sent": False,
            "error": f"ClientError:{code or 'Unknown'}",
            "details": e.response.get("Error", {}).get("Message", ""),
        }