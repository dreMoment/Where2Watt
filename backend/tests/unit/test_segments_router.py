import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from routers.segments import _upsert_actor_rating_for_segment


@pytest.mark.unit
def test_rating_upsert_reports_new_and_existing_rows():
    segment_id = ObjectId()
    collection = SimpleNamespace(
        update_one=AsyncMock(
            side_effect=[
                SimpleNamespace(upserted_id=ObjectId()),
                SimpleNamespace(upserted_id=None),
            ]
        )
    )
    db = SimpleNamespace(segment_ratings=collection)

    assert asyncio.run(_upsert_actor_rating_for_segment(db, segment_id, "actor-1", {"overall_quality": 8})) == "added"
    assert asyncio.run(_upsert_actor_rating_for_segment(db, segment_id, "actor-1", {"overall_quality": 9})) == "updated"
    assert collection.update_one.await_count == 2
    assert all(call.kwargs == {"upsert": True} for call in collection.update_one.await_args_list)


@pytest.mark.unit
def test_rating_upsert_recovers_when_a_concurrent_insert_wins():
    segment_id = ObjectId()
    collection = SimpleNamespace(
        update_one=AsyncMock(
            side_effect=[
                DuplicateKeyError("duplicate actor/segment pair"),
                SimpleNamespace(upserted_id=None),
            ]
        )
    )
    db = SimpleNamespace(segment_ratings=collection)

    status = asyncio.run(_upsert_actor_rating_for_segment(db, segment_id, "actor-1", {"overall_quality": 8}))

    assert status == "updated"
    retry = collection.update_one.await_args_list[1]
    assert retry.args[0] == {"segment_id": segment_id, "rated_by_actor_id": "actor-1"}
    assert retry.args[1]["$set"]["ratings"] == {"overall_quality": 8}
    assert retry.kwargs == {}
