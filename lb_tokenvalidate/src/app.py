import os
from typing import Any, Dict

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError


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


def _extract_token(event: Dict[str, Any]) -> str:
    """
    Espera invocación directa:
      event = {"data": "TOKEN_JWT"}
    """
    if not isinstance(event, dict):
        raise BadRequest("Event must be a JSON object")

    if "data" not in event:
        raise BadRequest('Missing required field "data"')

    token = event.get("data")
    if not isinstance(token, str) or not token.strip():
        raise BadRequest('"data" must be a non-empty string (JWT token)')
    return token.strip()


def validate_token(token: str) -> Dict[str, Any]:
    """
    Valida firma y exp. Retorna el payload (claims) si es válido.
    Lanza ExpiredSignatureError / InvalidTokenError si falla.
    """
    key = _get_jwt_key()
    payload = jwt.decode(token, key, algorithms=[DEFAULT_ALGORITHM])
    if not isinstance(payload, dict):
        # Extremely unlikely, but keeps output predictable
        raise InvalidTokenError("Token payload is not an object")
    return payload


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Input:
      {"data":"<TOKEN_JWT>"}

    Output OK:
      {"code":200,"data":{...claims...}}

    Output error:
      {"code":401,"message":"..."}
    """
    try:
        token = _extract_token(event)
    except BadRequest as e:
        return {"code": 401, "message": str(e)}  # siguiendo tu regla de 401 en fallas
    except Exception as e:
        return {"code": 401, "message": str(e)}

    try:
        payload = validate_token(token)
        return {"code": 200, "data": payload}
    except ExpiredSignatureError as e:
        return {"code": 401, "message": str(e)}
    except InvalidTokenError as e:
        return {"code": 401, "message": str(e)}
    except ConfigError as e:
        # si no hay key, también falla validación (puedes moverlo a 500 si prefieres)
        return {"code": 401, "message": str(e)}
    except Exception as e:
        return {"code": 401, "message": str(e)}
