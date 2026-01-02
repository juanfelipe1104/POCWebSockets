# src/app.py
import json
import logging
import os
from typing import Any, Dict, Optional

import requests

# --- Logging setup (AWS Lambda friendly) ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)


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


def _mask_authorization(headers: Dict[str, str]) -> Dict[str, str]:
    safe = dict(headers)
    if "Authorization" in safe and isinstance(safe["Authorization"], str):
        auth = safe["Authorization"]
        safe["Authorization"] = f"{auth[:10]}****" if len(auth) > 10 else "****"
    return safe


def log_http_request(method: str, url: str, headers: Dict[str, str], body: Any) -> None:
    safe_headers = _mask_authorization(headers)
    logger.debug("[COGNITO REQUEST] %s %s", method, url)
    logger.debug("Headers: %s", safe_headers)
    logger.debug("Body: %s", body)


def log_http_response(status_code: int, body: Any) -> None:
    logger.debug("[COGNITO RESPONSE] Status: %s", status_code)
    logger.debug("Body: %s", body)


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

    # Ajusta grant_type si tu caso difiere (authorization_code, password, etc.)
    data = {"grant_type": "client_credentials"}

    # Log detallado (solo si LOG_LEVEL=DEBUG)
    log_http_request("POST", url, headers, data)

    resp = requests.post(url, headers=headers, data=data, timeout=timeout_seconds)

    # Si hay error HTTP, logueamos response y levantamos excepción controlada
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        # Intentar parsear json, si no, texto
        try:
            err_body = resp.json()
        except Exception:
            err_body = resp.text
        log_http_response(resp.status_code, err_body)

        detail = err_body
        raise requests.HTTPError(f"HTTP {resp.status_code}: {detail}", response=resp) from e

    # Respuesta esperada JSON
    try:
        token_payload = resp.json()
    except Exception:
        log_http_response(resp.status_code, resp.text)
        raise ValueError("Respuesta inválida: no es JSON válido.")

    log_http_response(resp.status_code, token_payload)

    if not isinstance(token_payload, dict):
        raise ValueError("La respuesta del endpoint no es un JSON objeto.")
    if "access_token" not in token_payload:
        raise ValueError("La respuesta no contiene 'access_token'.")

    return token_payload


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    url = os.getenv("URL_ACCESS_TOKEN")
    if not url:
        logger.error("Falta la variable de entorno URL_ACCESS_TOKEN.")
        return _response(500, message="Falta la variable de entorno URL_ACCESS_TOKEN.")

    credentials = _extract_credentials(event or {})
    if not credentials or not isinstance(credentials, str) or not credentials.strip():
        logger.warning("Solicitud inválida: falta 'credentials' o no es un string válido.")
        return _response(400, message="El campo 'credentials' es requerido y debe ser un string no vacío.")

    try:
        token_payload = fetch_cognito_token(url=url, credentials=credentials)

        # Retornamos el JWT principal (access_token) + metadata
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
        logger.error("Timeout invocando el endpoint de token.")
        return _response(504, message="Timeout invocando el endpoint de token.")
    except requests.RequestException as e:
        logger.error("Error invocando endpoint de token: %s", str(e))
        return _response(401, message=f"Error invocando endpoint de token: {str(e)}")
    except (ValueError, json.JSONDecodeError) as e:
        logger.error("Respuesta inválida del endpoint de token: %s", str(e))
        return _response(502, message=f"Respuesta inválida del endpoint de token: {str(e)}")
