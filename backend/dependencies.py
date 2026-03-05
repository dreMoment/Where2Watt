import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException

from config import ACTOR_ID_SECRET, ADMIN_STRAVA_IDS, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, JWT_SECRET


@dataclass(frozen=True)
class ActorIdentity:
    actor_id: str
    is_admin: bool


def actor_id_from_strava_id(strava_id: int) -> str:
    # Deterministic pseudonymous actor identifier derived from Strava ID.
    message = str(strava_id).encode("utf-8")
    secret = ACTOR_ID_SECRET.encode("utf-8")
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


ADMIN_ACTOR_IDS: set[str] = {actor_id_from_strava_id(strava_id) for strava_id in ADMIN_STRAVA_IDS}


def verify_user(authorization: Annotated[str, Header()] = None) -> ActorIdentity:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        actor_id = payload["actor_id"]
        is_admin = bool(payload.get("is_admin", False))
        if not isinstance(actor_id, str) or not actor_id:
            raise KeyError("actor_id")
        return ActorIdentity(actor_id=actor_id, is_admin=is_admin)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


def verify_admin(identity: ActorIdentity = Depends(verify_user)):
    # Enforce current server-side admin config even if an old token claim exists.
    if not identity.is_admin or identity.actor_id not in ADMIN_ACTOR_IDS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return True


def create_jwt(actor_id: str, is_admin: bool) -> str:
    payload = {
        "actor_id": actor_id,
        "is_admin": bool(is_admin),
        "exp": datetime.now(timezone.utc).timestamp() + JWT_EXPIRATION_HOURS * 3600,
        "iat": datetime.now(timezone.utc).timestamp(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
