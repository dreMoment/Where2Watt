from types import SimpleNamespace
from unittest.mock import AsyncMock

import jwt
import pytest

from config import JWT_ALGORITHM, JWT_SECRET
from dependencies import actor_id_from_strava_id


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
def test_strava_callback_rejects_failed_oauth(monkeypatch, app_client):
    import routers.auth as auth_router

    mock_client = SimpleNamespace(post=AsyncMock(return_value=SimpleNamespace(status_code=500, json=lambda: {})))
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))
    mock_db = SimpleNamespace(strava_auth=SimpleNamespace(update_one=AsyncMock()), revoked_actors=SimpleNamespace(delete_many=AsyncMock()))
    monkeypatch.setattr(auth_router, "get_db", lambda: mock_db)

    res = app_client.post("/api/auth/strava/callback", json={"code": "code-1", "redirect_uri": "http://localhost/cb"})

    assert res.status_code == 400
    assert res.json()["detail"] == "Failed to authenticate with Strava"


@pytest.mark.integration
def test_strava_callback_rejects_missing_athlete_id(monkeypatch, app_client):
    import routers.auth as auth_router

    mock_client = SimpleNamespace(post=AsyncMock(return_value=SimpleNamespace(status_code=200, json=lambda: {"athlete": {}})))
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))
    mock_db = SimpleNamespace(strava_auth=SimpleNamespace(update_one=AsyncMock()), revoked_actors=SimpleNamespace(delete_many=AsyncMock()))
    monkeypatch.setattr(auth_router, "get_db", lambda: mock_db)

    res = app_client.post("/api/auth/strava/callback", json={"code": "code-1", "redirect_uri": "http://localhost/cb"})

    assert res.status_code == 400
    assert res.json()["detail"] == "No athlete data received from Strava"


@pytest.mark.integration
def test_strava_callback_returns_jwt_and_actor_identity(monkeypatch, app_client):
    import routers.auth as auth_router

    strava_id = 987654
    mock_client = SimpleNamespace(
        post=AsyncMock(return_value=SimpleNamespace(status_code=200, json=lambda: {"athlete": {"id": strava_id}}))
    )
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))
    mock_db = SimpleNamespace(strava_auth=SimpleNamespace(update_one=AsyncMock()), revoked_actors=SimpleNamespace(delete_many=AsyncMock()))
    monkeypatch.setattr(auth_router, "get_db", lambda: mock_db)

    res = app_client.post("/api/auth/strava/callback", json={"code": "code-1", "redirect_uri": "http://localhost/cb"})

    assert res.status_code == 200
    body = res.json()
    assert body["user"]["actor_id"] == actor_id_from_strava_id(strava_id)
    assert body["user"]["is_admin"] is True
    claims = jwt.decode(body["token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert claims["actor_id"] == body["user"]["actor_id"]
    mock_db.strava_auth.update_one.assert_awaited_once()
    _, update_doc = mock_db.strava_auth.update_one.await_args.args[:2]
    assert "strava_athlete_id" not in update_doc["$set"]
    mock_db.revoked_actors.delete_many.assert_awaited_once_with({"actor_id": body["user"]["actor_id"]})
