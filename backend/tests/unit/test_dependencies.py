from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from config import JWT_ALGORITHM, JWT_SECRET
from dependencies import ActorIdentity, actor_id_from_strava_id, create_jwt, verify_admin, verify_user


def _expired_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "actor_id": actor_id_from_strava_id(123),
        "is_admin": False,
        "exp": (now - timedelta(hours=1)).timestamp(),
        "iat": (now - timedelta(hours=2)).timestamp(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@pytest.mark.unit
def test_verify_admin_accepts_admin_strava_id():
    identity = ActorIdentity(actor_id=actor_id_from_strava_id(987654), is_admin=True)
    assert verify_admin(identity) is True


@pytest.mark.unit
@pytest.mark.parametrize(
    "identity",
    [
        pytest.param(ActorIdentity(actor_id=actor_id_from_strava_id(12345), is_admin=False), id="non-admin"),
        # A token that still claims admin must be rejected once the actor is not in the server-side admin list.
        pytest.param(ActorIdentity(actor_id=actor_id_from_strava_id(1234567), is_admin=True), id="stale-admin-claim"),
    ],
)
def test_verify_admin_rejects_non_admins(identity):
    with pytest.raises(HTTPException) as exc:
        verify_admin(identity)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Admin access required"


@pytest.mark.unit
def test_verify_user_roundtrip_with_created_jwt():
    actor_id = actor_id_from_strava_id(12345)
    token = create_jwt(actor_id=actor_id, is_admin=False)
    identity = verify_user(f"Bearer {token}")
    assert identity.actor_id == actor_id
    assert identity.is_admin is False


@pytest.mark.unit
@pytest.mark.parametrize(
    ("authorization", "detail"),
    [
        pytest.param(None, "Not authenticated", id="missing-header"),
        pytest.param("Bearer invalid.token.value", "Invalid token", id="invalid-token"),
        pytest.param(f"Bearer {_expired_token()}", "Token expired", id="expired-token"),
        pytest.param(
            f"Bearer {jwt.encode({'is_admin': False}, JWT_SECRET, algorithm=JWT_ALGORITHM)}",
            "Invalid token",
            id="missing-actor-id-claim",
        ),
    ],
)
def test_verify_user_rejects_unauthenticated_requests(authorization, detail):
    with pytest.raises(HTTPException) as exc:
        verify_user(authorization)
    assert exc.value.status_code == 401
    assert exc.value.detail == detail
