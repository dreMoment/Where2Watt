import asyncio
from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock

import pytest

from services.account_cleanup import purge_actor_data


@pytest.mark.unit
def test_purge_actor_data_anonymizes_submissions_and_deletes_actor_ratings_and_reports():
    actor_id = "actor-123"

    db = SimpleNamespace(
        segments=SimpleNamespace(
            update_many=AsyncMock(return_value=SimpleNamespace(modified_count=2)),
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=0)),
        ),
        segment_ratings=SimpleNamespace(
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=5)),
        ),
        segment_block_reports=SimpleNamespace(
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
        ),
        strava_auth=SimpleNamespace(
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
        ),
        revoked_actors=SimpleNamespace(update_one=AsyncMock()),
    )

    result = asyncio.run(purge_actor_data(db, actor_id))

    assert result == {
        "submitted_segments_anonymized": 2,
        "actor_ratings_deleted": 5,
        "actor_reports_deleted": 1,
        "strava_auth_rows_deleted": 1,
    }

    db.segments.update_many.assert_awaited_once_with(
        {"submitted_by_actor_id": actor_id},
        {"$unset": {"submitted_by_actor_id": "", "submitted_by_agent_id": ""}},
    )
    db.segment_ratings.delete_many.assert_awaited_once_with({"rated_by_actor_id": actor_id})
    db.segment_block_reports.delete_many.assert_awaited_once_with({"reported_by_actor_id": actor_id})
    db.strava_auth.delete_many.assert_awaited_once_with({"actor_id": actor_id})
    db.revoked_actors.update_one.assert_awaited_once_with(
        {"actor_id": actor_id},
        {
            "$set": {
                "actor_id": actor_id,
                "revoked_at": ANY,
                "revoked_until": ANY,
            }
        },
        upsert=True,
    )

    # Ensure disconnect does not delete submitted segment content.
    db.segments.delete_many.assert_not_called()


@pytest.mark.unit
def test_purge_actor_data_reports_zero_when_no_matches():
    actor_id = "actor-456"

    db = SimpleNamespace(
        segments=SimpleNamespace(update_many=AsyncMock(return_value=SimpleNamespace(modified_count=0))),
        segment_ratings=SimpleNamespace(delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=0))),
        segment_block_reports=SimpleNamespace(delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=0))),
        strava_auth=SimpleNamespace(delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=0))),
        revoked_actors=SimpleNamespace(update_one=AsyncMock()),
    )

    result = asyncio.run(purge_actor_data(db, actor_id))

    assert result == {
        "submitted_segments_anonymized": 0,
        "actor_ratings_deleted": 0,
        "actor_reports_deleted": 0,
        "strava_auth_rows_deleted": 0,
    }
