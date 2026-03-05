import pytest
from fastapi import HTTPException

from dependencies import create_jwt, verify_admin, verify_user


@pytest.mark.unit
def test_verify_admin_accepts_admin_strava_id():
    assert verify_admin(987654) is True


@pytest.mark.unit
def test_verify_admin_rejects_non_admin_strava_id():
    with pytest.raises(HTTPException) as exc:
        verify_admin(12345)
    assert exc.value.status_code == 403


@pytest.mark.unit
def test_verify_user_roundtrip_with_created_jwt():
    token = create_jwt(12345)
    strava_id = verify_user(f"Bearer {token}")
    assert strava_id == 12345


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
