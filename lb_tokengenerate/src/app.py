import os
import time
from typing import Any, Dict, Optional, Tuple

import jwt


DEFAULT_TTL_SECONDS = 15 * 60  # 15 minutos
DEFAULT_ALGORITHM = "HS256"


class ConfigError(RuntimeError):
    pass


class BadRequest(ValueError):
    pass


def _get_jwt_key() -> str:
    key = os.getenv("JWT_KEY")
    if not key or not isinstance(key, str) or not key.strip():
        raise ConfigError("Missing or empty JWT_KEY environment variable")
    return key


def _coerce_ttl_seconds(value: Any, default: int = DEFAULT_TTL_SECONDS) -> int:
    if value is None:
        return default
    try:
        ttl = int(value)
    except (TypeError, ValueError) as e:
        raise BadRequest("ttl_seconds must be an integer") from e
    if ttl <= 0:
        raise BadRequest("ttl_seconds must be > 0")
    # límite razonable para evitar tokens eternos por error
    if ttl > 24 * 60 * 60:
        raise BadRequest("ttl_seconds must be <= 86400")
    return ttl


def _extract_claims(event: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Espera invocación directa:
      event = {"data": {...claims...}}

    Opcionalmente permite:
      event = {"data": {...claims...}, "ttl_seconds": 900}

    Devuelve: (claims, ttl_seconds)
    """
    if not isinstance(event, dict):
        raise BadRequest("Event must be a JSON object")

    if "data" not in event:
        raise BadRequest('Missing required field "data"')

    claims = event.get("data")
    if not isinstance(claims, dict):
        raise BadRequest('"data" must be a JSON object')

    ttl_seconds = _coerce_ttl_seconds(event.get("ttl_seconds"), DEFAULT_TTL_SECONDS)
    return claims, ttl_seconds


def create_token(
    *,
    claims: Dict[str, Any],
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    algorithm: str = DEFAULT_ALGORITHM,
    now: Optional[int] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Genera un JWT firmado con HS256 usando JWT_KEY.

    Retorna (token, payload_firmado).
    """
    key = _get_jwt_key()

    if now is None:
        now = int(time.time())

    ttl_seconds = _coerce_ttl_seconds(ttl_seconds, DEFAULT_TTL_SECONDS)

    payload: Dict[str, Any] = dict(claims)  # copia
    payload["iat"] = now
    payload["exp"] = now + ttl_seconds

    token = jwt.encode(payload, key, algorithm=algorithm)
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return token, payload


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Input:
      {"data": {...claims...}}

    Output OK:
      {"code":200,"data":{"token":"...","token_type":"Bearer","expires_in":900,"expires_at":<unix_ts>}}
    """
    try:
        claims, ttl_seconds = _extract_claims(event)
        token, payload = create_token(claims=claims, ttl_seconds=ttl_seconds)

        return {
            "code": 200,
            "data": {
                "token": token,
                "token_type": "Bearer",
                "expires_in": ttl_seconds,
                "expires_at": payload["exp"],  # unix timestamp
            },
        }

    except BadRequest as e:
        return {"code": 400, "error": "BAD_REQUEST", "message": str(e)}
    except ConfigError as e:
        return {"code": 500, "error": "CONFIG_ERROR", "message": str(e)}
    except Exception as e:
        return {"code": 500, "error": "INTERNAL_ERROR", "message": str(e)}
