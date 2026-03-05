from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException

from config import ADMIN_STRAVA_IDS, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, JWT_SECRET


def verify_user(authorization: Annotated[str, Header()] = None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["strava_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


def verify_admin(strava_id: int = Depends(verify_user)):
    if strava_id not in ADMIN_STRAVA_IDS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return True


def create_jwt(strava_id: int) -> str:
    payload = {
        "strava_id": strava_id,
        "exp": datetime.now(timezone.utc).timestamp() + JWT_EXPIRATION_HOURS * 3600,
        "iat": datetime.now(timezone.utc).timestamp(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
