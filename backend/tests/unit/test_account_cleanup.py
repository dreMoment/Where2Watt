import asyncio
from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock

import pytest

from services.account_cleanup import purge_actor_data


@pytest.mark.unit
def test_purge_actor_data_deletes_actor_ratings_reports_and_auth_rows():
    actor_id = "actor-123"

    db = SimpleNamespace(
        segment_ratings=SimpleNamespace(
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=5)),
        ),
        segment_block_reports=SimpleNamespace(
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
        ),
        strava_auth=SimpleNamespace(
            delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
        ),
        user_preferences=SimpleNamespace(delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=1))),
        starred_segment_sightings=SimpleNamespace(delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=3))),
        revoked_actors=SimpleNamespace(update_one=AsyncMock()),
    )

    result = asyncio.run(purge_actor_data(db, actor_id))

    assert result == {
        "actor_ratings_deleted": 5,
        "actor_reports_deleted": 1,
        "strava_auth_rows_deleted": 1,
        "user_preferences_rows_deleted": 1,
        "starred_segment_sightings_deleted": 3,
    }

    db.segment_ratings.delete_many.assert_awaited_once_with({"rated_by_actor_id": actor_id})
    db.segment_block_reports.delete_many.assert_awaited_once_with({"reported_by_actor_id": actor_id})
    db.strava_auth.delete_many.assert_awaited_once_with({"actor_id": actor_id})
    db.user_preferences.delete_many.assert_awaited_once_with({"actor_id": actor_id})
    db.starred_segment_sightings.delete_many.assert_awaited_once_with({"actor_id": actor_id})
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

