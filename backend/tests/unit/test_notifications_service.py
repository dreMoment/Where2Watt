import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import services.notifications as notifications_service
from tests.helpers import MockAsyncClientContext


@pytest.mark.unit
def test_notify_new_segment_submission_prefers_canonical_segment_link(monkeypatch):
    monkeypatch.setattr(notifications_service, "ADMIN_DISCORD_WEBHOOK_URL", "https://discord.invalid/webhook")

    mock_response = SimpleNamespace(raise_for_status=lambda: None)
    mock_client = SimpleNamespace(post=AsyncMock(return_value=mock_response))
    monkeypatch.setattr(notifications_service.httpx, "AsyncClient", lambda timeout=5.0: MockAsyncClientContext(mock_client))

    asyncio.run(
        notifications_service.notify_new_segment_submission(
            strava_url="https://www.strava.com/activities/17650152462/segments/3465746799772048188",
            strava_id="123456789",
            segment_name="Test Segment",
            submitted_by_actor_id="actor-1",
            created_at="2026-03-13T10:00:00+00:00",
        )
    )

    mock_client.post.assert_awaited_once()
    payload = mock_client.post.await_args.kwargs["json"]["content"]
    assert "https://www.strava.com/segments/123456789" in payload
    assert "activities/17650152462/segments/3465746799772048188" not in payload
