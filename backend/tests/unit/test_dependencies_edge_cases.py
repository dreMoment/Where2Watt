from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from config import JWT_ALGORITHM, JWT_SECRET
from dependencies import ActorIdentity, actor_id_from_strava_id, verify_admin, verify_user


@pytest.mark.unit
def test_verify_user_rejects_expired_token():
    payload = {
        "actor_id": actor_id_from_strava_id(123),
        "is_admin": False,
        "exp": (datetime.now(timezone.utc) - timedelta(hours=1)).timestamp(),
        "iat": (datetime.now(timezone.utc) - timedelta(hours=2)).timestamp(),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc:
        verify_user(f"Bearer {token}")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Token expired"


@pytest.mark.unit
def test_verify_user_rejects_missing_actor_id_claim():
    token = jwt.encode({"is_admin": False}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc:
        verify_user(f"Bearer {token}")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


@pytest.mark.unit
def test_verify_admin_rejects_identity_if_actor_not_in_admin_list():
    with pytest.raises(HTTPException) as exc:
        verify_admin(ActorIdentity(actor_id=actor_id_from_strava_id(1234567), is_admin=True))
    assert exc.value.status_code == 403
    assert exc.value.detail == "Admin access required"
