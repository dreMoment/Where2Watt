from types import SimpleNamespace
from unittest.mock import AsyncMock

import jwt
import pytest

from config import JWT_ALGORITHM, JWT_SECRET
from dependencies import actor_id_from_strava_id
from tests.helpers import MockAsyncClientContext


pytestmark = pytest.mark.usefixtures("disable_rate_limiter")


@pytest.mark.integration
@pytest.mark.parametrize(
    ("oauth_status", "oauth_body", "detail"),
    [
        pytest.param(500, {}, "Failed to authenticate with Strava", id="failed-oauth"),
        pytest.param(200, {"athlete": {}}, "No athlete data received from Strava", id="missing-athlete-id"),
    ],
)
def test_strava_callback_rejects_bad_oauth_response(monkeypatch, app_client, oauth_status, oauth_body, detail):
    import routers.auth as auth_router

    mock_client = SimpleNamespace(post=AsyncMock(return_value=SimpleNamespace(status_code=oauth_status, json=lambda: oauth_body)))
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))
    mock_db = SimpleNamespace(strava_auth=SimpleNamespace(update_one=AsyncMock()), revoked_actors=SimpleNamespace(delete_many=AsyncMock()))
    monkeypatch.setattr(auth_router, "get_db", lambda: mock_db)

    res = app_client.post("/api/auth/strava/callback", json={"code": "code-1", "redirect_uri": "http://localhost/cb"})

    assert res.status_code == 400
    assert res.json()["detail"] == detail


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
