import pytest

from dependencies import actor_id_from_strava_id, create_jwt


@pytest.mark.integration
def test_health_check_reports_db_connected(app_client):
    response = app_client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["db_connected"] is True


@pytest.mark.integration
def test_auth_me_requires_token(app_client):
    response = app_client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.integration
def test_auth_me_returns_user_for_valid_token(app_client):
    actor_id = actor_id_from_strava_id(987654)
    token = create_jwt(actor_id=actor_id, is_admin=True)
    response = app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "actor_id": actor_id,
        "is_admin": True,
    }


@pytest.mark.integration
def test_auth_preferences_returns_default_when_not_set(app_client):
    actor_id = actor_id_from_strava_id(123456)
    token = create_jwt(actor_id=actor_id, is_admin=False)

    response = app_client.get("/api/auth/preferences", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {"hide_info_screen": False}


@pytest.mark.integration
def test_auth_preferences_can_be_updated_and_read(app_client):
    actor_id = actor_id_from_strava_id(123457)
    token = create_jwt(actor_id=actor_id, is_admin=False)

    update_response = app_client.patch(
        "/api/auth/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"hide_info_screen": True},
    )
    assert update_response.status_code == 200
    assert update_response.json() == {"hide_info_screen": True}

    read_response = app_client.get("/api/auth/preferences", headers={"Authorization": f"Bearer {token}"})
    assert read_response.status_code == 200
    assert read_response.json() == {"hide_info_screen": True}


@pytest.mark.integration
def test_admin_verify_with_admin_user_token(app_client):
    token = create_jwt(actor_id=actor_id_from_strava_id(987654), is_admin=True)
    response = app_client.post("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.integration
def test_admin_verify_rejects_non_admin_user(app_client):
    token = create_jwt(actor_id=actor_id_from_strava_id(555555), is_admin=False)
    response = app_client.post("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
