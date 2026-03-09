import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock

import pytest

from dependencies import actor_id_from_strava_id, create_jwt


class MockAsyncClientContext:
    def __init__(self, client):
        self.client = client

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.fixture(autouse=True)
def disable_rate_limiter():
    from main import app

    app.state.limiter.enabled = False
    yield
    app.state.limiter.enabled = True


@pytest.mark.integration
def test_disconnect_deauthorizes_and_purges_actor_data(monkeypatch, app_client):
    import dependencies
    import routers.auth as auth_router

    actor_id = actor_id_from_strava_id(12345)
    token = create_jwt(actor_id=actor_id, is_admin=False)

    mock_db = SimpleNamespace(
        revoked_actors=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        strava_auth=SimpleNamespace(find_one=AsyncMock(return_value={"access_token": "access-123"})),
    )
    monkeypatch.setattr(dependencies, "get_db", lambda: mock_db)
    monkeypatch.setattr(auth_router, "get_db", lambda: mock_db)

    mock_client = SimpleNamespace(post=AsyncMock(return_value=SimpleNamespace(status_code=200, json=lambda: {})))
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    deleted_payload = {
        "submitted_segments_anonymized": 1,
        "actor_ratings_deleted": 4,
        "actor_reports_deleted": 5,
        "strava_auth_rows_deleted": 1,
    }
    purge_mock = AsyncMock(return_value=deleted_payload)
    monkeypatch.setattr(auth_router, "purge_actor_data", purge_mock)

    response = app_client.post("/api/auth/disconnect", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "status": "disconnected",
        "deauthorized_with_strava": True,
        "deleted": deleted_payload,
    }
    mock_client.post.assert_awaited_once_with(
        "https://www.strava.com/oauth/deauthorize",
        data={"access_token": "access-123"},
    )
    purge_mock.assert_awaited_once_with(mock_db, actor_id)


@pytest.mark.integration
def test_auth_me_rejects_revoked_actor(monkeypatch, app_client):
    import dependencies

    actor_id = actor_id_from_strava_id(12345)
    token = create_jwt(actor_id=actor_id, is_admin=False)

    mock_db = SimpleNamespace(
        revoked_actors=SimpleNamespace(find_one=AsyncMock(return_value={"actor_id": actor_id})),
    )
    monkeypatch.setattr(dependencies, "get_db", lambda: mock_db)

    response = app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Strava access has been revoked"


@pytest.mark.integration
def test_webhook_verification_returns_challenge(monkeypatch, app_client):
    import routers.strava_webhook as strava_webhook_router

    monkeypatch.setattr(strava_webhook_router, "STRAVA_WEBHOOK_VERIFY_TOKEN", "verify-me")

    response = app_client.get(
        "/api/strava/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123"
    )

    assert response.status_code == 200
    assert response.json() == {"hub.challenge": "abc123"}


@pytest.mark.integration
def test_webhook_deauthorization_event_purges_actor_data(monkeypatch, app_client):
    import routers.strava_webhook as strava_webhook_router

    secret = "webhook-secret"
    monkeypatch.setattr(strava_webhook_router, "STRAVA_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(strava_webhook_router, "get_db", lambda: SimpleNamespace())
    purge_mock = AsyncMock(
        return_value={
            "submitted_segments_anonymized": 0,
            "actor_ratings_deleted": 0,
            "actor_reports_deleted": 0,
            "strava_auth_rows_deleted": 0,
        }
    )
    monkeypatch.setattr(strava_webhook_router, "purge_actor_data", purge_mock)

    athlete_id = 12345
    payload = {
        "object_type": "athlete",
        "object_id": athlete_id,
        "aspect_type": "update",
        "updates": {"authorized": "false"},
    }
    body = json.dumps(payload).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    response = app_client.post(
        "/api/strava/webhook",
        data=body,
        headers={"X-Strava-Signature": signature, "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "received", "processed": True}
    purge_mock.assert_awaited_once_with(ANY, actor_id_from_strava_id(athlete_id))
