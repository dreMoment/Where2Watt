import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import services.strava as strava_service


class MockAsyncClientContext:
    def __init__(self, client):
        self.client = client

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.unit
def test_get_strava_access_token_returns_none_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(strava_service, "STRAVA_CLIENT_ID", None)
    monkeypatch.setattr(strava_service, "STRAVA_CLIENT_SECRET", None)
    monkeypatch.setattr(strava_service, "STRAVA_REFRESH_TOKEN", None)

    token = asyncio.run(strava_service.get_strava_access_token())
    assert token is None


@pytest.mark.unit
def test_get_strava_access_token_success(monkeypatch):
    mock_client = SimpleNamespace(
        post=AsyncMock(return_value=SimpleNamespace(status_code=200, json=lambda: {"access_token": "abc123"}))
    )
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    token = asyncio.run(strava_service.get_strava_access_token())
    assert token == "abc123"


@pytest.mark.unit
def test_fetch_segment_details_returns_normalized_payload(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="token-1"))
    mock_response = SimpleNamespace(
        status_code=200,
        json=lambda: {"map": {"polyline": "xyz"}, "name": "Segment A", "distance": 1234, "average_grade": 3.26},
    )
    mock_client = SimpleNamespace(get=AsyncMock(return_value=mock_response))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    details = asyncio.run(strava_service.fetch_segment_details("42"))

    assert details == {
        "polyline": "xyz",
        "name": "Segment A",
        "distance_km": 1.23,
        "gradient_pct": 3.3,
    }


@pytest.mark.unit
def test_fetch_segment_details_supports_avg_grade_fallback(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="token-1"))
    mock_response = SimpleNamespace(
        status_code=200,
        json=lambda: {"map": {"polyline": "xyz"}, "name": "Segment A", "distance": 1234, "avg_grade": 4.04},
    )
    mock_client = SimpleNamespace(get=AsyncMock(return_value=mock_response))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    details = asyncio.run(strava_service.fetch_segment_details("42"))

    assert details == {
        "polyline": "xyz",
        "name": "Segment A",
        "distance_km": 1.23,
        "gradient_pct": 4.0,
    }


@pytest.mark.unit
def test_get_strava_access_token_prefers_actor_token(monkeypatch):
    actor_id = "actor-123"
    valid_expires_at = int(time.time()) + 3600
    mock_db = SimpleNamespace(
        strava_auth=SimpleNamespace(
            find_one=AsyncMock(return_value={"actor_id": actor_id, "access_token": "actor-token", "expires_at": valid_expires_at})
        )
    )

    token = asyncio.run(strava_service.get_strava_access_token(db=mock_db, actor_id=actor_id))
    assert token == "actor-token"


@pytest.mark.unit
def test_fetch_segment_details_returns_none_when_segment_missing_or_request_fails(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="token-1"))
    mock_client = SimpleNamespace(get=AsyncMock(return_value=SimpleNamespace(status_code=404, json=lambda: {})))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    assert asyncio.run(strava_service.fetch_segment_details("")) is None
    assert asyncio.run(strava_service.fetch_segment_details("11")) is None
