from slowapi import Limiter
from slowapi.util import get_remote_address
import jwt

from config import JWT_ALGORITHM, JWT_SECRET


def _get_actor_id_for_rate_limit(request) -> str:
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return "anonymous"

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return "anonymous"

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return "anonymous"

    actor_id = payload.get("actor_id")
    if not isinstance(actor_id, str) or not actor_id:
        return "anonymous"
    return actor_id


def rate_limit_key(request) -> str:
    actor_id = _get_actor_id_for_rate_limit(request)
    ip_address = get_remote_address(request) or "unknown"
    return f"actor:{actor_id}|ip:{ip_address}"


limiter = Limiter(key_func=rate_limit_key)
