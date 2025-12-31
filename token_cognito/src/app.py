import json
import os
from typing import Any, Dict, Optional

import requests


def _response(code: int, data: Optional[Dict[str, Any]] = None, message: Optional[str] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"code": code}
    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    return payload


def _extract_credentials(event: Dict[str, Any]) -> Optional[str]:
    """
    Soporta:
      - Invocación directa: {"credentials": "..."}
      - API Gateway style: {"body": "{\"credentials\":\"...\"}"} o {"body":{"credentials":"..."}}
    """
    if isinstance(event, dict) and "credentials" in event:
        return event.get("credentials")

    body = event.get("body") if isinstance(event, dict) else None
    if body is None:
        return None

    if isinstance(body, dict):
        return body.get("credentials")

    if isinstance(body, str) and body.strip():
        try:
            parsed = json.loads(body)
            if isinstance(parsed, dict):
                return parsed.get("credentials")
        except json.JSONDecodeError:
            return None

    return None


def _normalize_basic(credentials: str) -> str:
    """
    Acepta 'XXX' o 'Basic XXX' y devuelve SIEMPRE el valor correcto para el header Authorization.
    """
    cred = credentials.strip()
    if cred.lower().startswith("basic "):
        return cred
    return f"Basic {cred}"


def fetch_cognito_token(url: str, credentials: str, timeout_seconds: float = 10.0) -> Dict[str, Any]:
    """
    Llama el endpoint de token (Cognito /oauth2/token usualmente) usando Basic credentials.
    Por defecto usa grant_type=client_credentials.
    """
    headers = {
        "Authorization": _normalize_basic(credentials),
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }

    # Ajusta grant_type aquí si tu caso difiere (p.ej. authorization_code, password, etc.)
    data = {"grant_type": "client_credentials"}

    resp = requests.post(url, headers=headers, data=data, timeout=timeout_seconds)

    # Errores HTTP -> excepción controlada
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        # Intentar extraer detalle del body si viene JSON
        detail = None
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text.strip() or None
        raise requests.HTTPError(f"HTTP {resp.status_code}: {detail}", response=resp) from e

    # Respuesta esperada JSON
    token_payload = resp.json()
    if not isinstance(token_payload, dict):
        raise ValueError("La respuesta del endpoint no es un JSON objeto.")

    # Cognito típicamente devuelve access_token, token_type, expires_in (y a veces id_token según flujo)
    if "access_token" not in token_payload:
        raise ValueError("La respuesta no contiene 'access_token'.")

    return token_payload


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    url = os.getenv("URL_ACCESS_TOKEN")
    if not url:
        return _response(500, message="Falta la variable de entorno URL_ACCESS_TOKEN.")

    credentials = _extract_credentials(event or {})
    if not credentials or not isinstance(credentials, str) or not credentials.strip():
        return _response(400, message="El campo 'credentials' es requerido y debe ser un string no vacío.")

    try:
        token_payload = fetch_cognito_token(url=url, credentials=credentials)
        # Retornamos el JWT principal (access_token) y dejamos también el payload completo por trazabilidad
        return _response(
            200,
            data={
                "token": token_payload.get("access_token"),
                "token_type": token_payload.get("token_type"),
                "expires_in": token_payload.get("expires_in"),
                "raw": token_payload,
            },
        )
    except requests.Timeout:
        return _response(504, message="Timeout invocando el endpoint de token.")
    except requests.RequestException as e:
        return _response(401, message=f"Error invocando endpoint de token: {str(e)}")
    except (ValueError, json.JSONDecodeError) as e:
        return _response(502, message=f"Respuesta inválida del endpoint de token: {str(e)}")
