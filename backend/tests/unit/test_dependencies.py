import pytest
from fastapi import HTTPException

from dependencies import ActorIdentity, actor_id_from_strava_id, create_jwt, verify_admin, verify_user


@pytest.mark.unit
def test_verify_admin_accepts_admin_strava_id():
    identity = ActorIdentity(actor_id=actor_id_from_strava_id(987654), is_admin=True)
    assert verify_admin(identity) is True


@pytest.mark.unit
def test_verify_admin_rejects_non_admin_strava_id():
    with pytest.raises(HTTPException) as exc:
        verify_admin(ActorIdentity(actor_id=actor_id_from_strava_id(12345), is_admin=False))
    assert exc.value.status_code == 403


@pytest.mark.unit
def test_verify_user_roundtrip_with_created_jwt():
    actor_id = actor_id_from_strava_id(12345)
    token = create_jwt(actor_id=actor_id, is_admin=False)
    identity = verify_user(f"Bearer {token}")
    assert identity.actor_id == actor_id
    assert identity.is_admin is False


@pytest.mark.unit
def test_verify_user_rejects_missing_header():
    with pytest.raises(HTTPException) as exc:
        verify_user(None)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Not authenticated"


@pytest.mark.unit
def test_verify_user_rejects_invalid_token():
    with pytest.raises(HTTPException) as exc:
        verify_user("Bearer invalid.token.value")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"
