from slowapi import Limiter
from slowapi.util import get_remote_address
import jwt
from uuid import uuid4

from config import JWT_ALGORITHM, JWT_SECRET
from dependencies import ADMIN_ACTOR_IDS


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


def _is_admin_token_for_rate_limit(request, actor_id: str) -> bool:
    if actor_id == "anonymous":
        return False

    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return False

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return False

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return False

    token_actor_id = payload.get("actor_id")
    if token_actor_id != actor_id:
        return False

    return bool(payload.get("is_admin", False)) and actor_id in ADMIN_ACTOR_IDS


def rate_limit_key(request) -> str:
    actor_id = _get_actor_id_for_rate_limit(request)
    if _is_admin_token_for_rate_limit(request, actor_id):
        existing_key = getattr(request.state, "admin_rate_limit_bypass_key", None)
        if isinstance(existing_key, str) and existing_key:
            return existing_key

        bypass_key = f"admin-bypass:{actor_id}:{uuid4()}"
        request.state.admin_rate_limit_bypass_key = bypass_key
        return bypass_key

    ip_address = get_remote_address(request) or "unknown"
    return f"actor:{actor_id}|ip:{ip_address}"


limiter = Limiter(key_func=rate_limit_key)
