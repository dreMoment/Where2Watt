import pytest

from dependencies import create_jwt


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
def test_auth_me_returns_user_for_valid_token(app_client, mongo_client, test_db_name):
    users = mongo_client[test_db_name]["users"]
    users.insert_one(
        {
            "strava_id": 987654,
            "username": "tester",
            "firstname": "Test",
            "lastname": "User",
            "profile_pic": "https://example.com/pic.png",
        }
    )

    token = create_jwt(987654)
    response = app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "strava_id": 987654,
        "username": "tester",
        "firstname": "Test",
        "lastname": "User",
        "profile_pic": "https://example.com/pic.png",
    }


@pytest.mark.integration
def test_admin_verify_with_admin_user_token(app_client):
    token = create_jwt(987654)
    response = app_client.post("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.integration
def test_admin_verify_rejects_non_admin_user(app_client):
    token = create_jwt(555555)
    response = app_client.post("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
