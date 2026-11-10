import pytest
from bson import ObjectId

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
def test_auth_preferences_default_then_update_and_read(app_client):
    actor_id = actor_id_from_strava_id(123457)
    headers = {"Authorization": f"Bearer {create_jwt(actor_id=actor_id, is_admin=False)}"}

    default_response = app_client.get("/api/auth/preferences", headers=headers)
    assert default_response.status_code == 200
    assert default_response.json() == {
        "hide_info_screen": False,
        "rider_weight_kg": 75.0,
        "bike_weight_kg": 9.0,
        "interval_filter_power_watts": 250.0,
        "interval_filter_minutes": 5.0,
    }

    updated = {
        "hide_info_screen": True,
        "rider_weight_kg": 72.5,
        "bike_weight_kg": 8.7,
        "interval_filter_power_watts": 280.0,
        "interval_filter_minutes": 6.0,
    }
    update_response = app_client.patch("/api/auth/preferences", headers=headers, json=updated)
    assert update_response.status_code == 200
    assert update_response.json() == updated

    read_response = app_client.get("/api/auth/preferences", headers=headers)
    assert read_response.status_code == 200
    assert read_response.json() == updated


@pytest.mark.integration
def test_auth_preferences_reject_values_outside_supported_ranges(app_client):
    actor_id = actor_id_from_strava_id(123458)
    token = create_jwt(actor_id=actor_id, is_admin=False)

    response = app_client.patch(
        "/api/auth/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"rider_weight_kg": -1},
    )

    assert response.status_code == 422


@pytest.mark.integration
@pytest.mark.parametrize(
    ("strava_id", "is_admin", "expected_status", "expected_body"),
    [
        pytest.param(987654, True, 200, {"status": "ok"}, id="admin"),
        pytest.param(555555, False, 403, {"detail": "Admin access required"}, id="non-admin"),
    ],
)
def test_admin_verify(app_client, strava_id, is_admin, expected_status, expected_body):
    token = create_jwt(actor_id=actor_id_from_strava_id(strava_id), is_admin=is_admin)
    response = app_client.post("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == expected_status
    assert response.json() == expected_body


_SEGMENT_ID = str(ObjectId())
_OTHER_ID = str(ObjectId())

# Every route guarded by verify_admin (grep `Depends(verify_admin)` in routers/).
ADMIN_ONLY_ROUTES = [
    ("POST", "/api/admin/verify", None),
    ("GET", "/api/admin/segments/unapproved", None),
    ("GET", "/api/admin/segments", None),
    ("GET", f"/api/admin/segments/{_SEGMENT_ID}/ratings", None),
    ("DELETE", f"/api/admin/segments/{_SEGMENT_ID}/ratings/{_OTHER_ID}", None),
    ("GET", f"/api/admin/segments/{_SEGMENT_ID}/blocked-reports", None),
    ("POST", f"/api/admin/segments/{_SEGMENT_ID}/approve", None),
    ("POST", f"/api/admin/segments/{_SEGMENT_ID}/merge", {"target_segment_id": _OTHER_ID}),
    ("POST", f"/api/admin/segments/{_SEGMENT_ID}/split", None),
    ("PATCH", f"/api/admin/segments/{_SEGMENT_ID}/block", {"message": "closed"}),
    ("PATCH", f"/api/admin/segments/{_SEGMENT_ID}/unblock", None),
    ("POST", "/api/admin/segments/quickadd", {"strava_url": "https://www.strava.com/segments/123"}),
    ("DELETE", f"/api/segments/{_SEGMENT_ID}", None),
]


@pytest.mark.integration
@pytest.mark.usefixtures("disable_rate_limiter")
@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ONLY_ROUTES, ids=[f"{m} {p}" for m, p, _ in ADMIN_ONLY_ROUTES])
def test_admin_only_routes_reject_non_admin_user(app_client, method, path, body):
    token = create_jwt(actor_id=actor_id_from_strava_id(555555), is_admin=False)
    response = app_client.request(method, path, json=body, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
