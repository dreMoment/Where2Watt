import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId

from services.segments import auto_unblock_if_needed, enrich_admin_segment_users, get_block_report_counts


class AggregateCursor:
    def __init__(self, items):
        self.items = items

    async def to_list(self, length=None):
        return self.items


class FindCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, length=None):
        return self.items


@pytest.mark.unit
def test_get_block_report_counts_returns_empty_for_no_segment_ids():
    def aggregate(*_args, **_kwargs):
        raise AssertionError("aggregate should not be called when segment list is empty")

    db = SimpleNamespace(segment_block_reports=SimpleNamespace(aggregate=aggregate))
    counts = asyncio.run(get_block_report_counts(db, []))
    assert counts == {}


@pytest.mark.unit
def test_get_block_report_counts_groups_by_segment_id():
    segment_id = ObjectId()

    def aggregate(*_args, **_kwargs):
        return AggregateCursor([{"_id": segment_id, "count": 3}])

    db = SimpleNamespace(segment_block_reports=SimpleNamespace(aggregate=aggregate))
    counts = asyncio.run(get_block_report_counts(db, [segment_id]))
    assert counts == {str(segment_id): 3}


@pytest.mark.unit
def test_enrich_admin_segment_users_dedupes_reporters_and_sets_summaries():
    segment_id = ObjectId()
    segments = [{"_id": segment_id, "submitted_by_actor_id": "submitter-1"}]
    reports = [
        {"segment_id": segment_id, "reported_by_actor_id": "actor-a", "reported_at": "2026-03-05T10:00:00+00:00"},
        {"segment_id": segment_id, "reported_by_actor_id": "actor-a", "reported_at": "2026-03-05T09:00:00+00:00"},
        {"segment_id": segment_id, "reported_by_actor_id": "actor-b", "reported_at": "2026-03-05T08:00:00+00:00"},
        {"segment_id": segment_id, "reported_by_actor_id": "", "reported_at": "2026-03-05T07:00:00+00:00"},
    ]
    def find(*_args, **_kwargs):
        return FindCursor(reports)

    db = SimpleNamespace(segment_block_reports=SimpleNamespace(find=find))

    asyncio.run(enrich_admin_segment_users(db, segments))

    assert segments[0]["reported_by_actor_ids"] == ["actor-a", "actor-b"]
    assert segments[0]["submitted_by_user"] == {"actor_id": "submitter-1"}
    assert segments[0]["reported_by_users"] == [{"actor_id": "actor-a"}, {"actor_id": "actor-b"}]


@pytest.mark.unit
def test_auto_unblock_if_needed_unblocks_when_date_has_passed():
    segment_id = ObjectId()
    now = datetime.now(timezone.utc)
    segment = {
        "_id": segment_id,
        "blocked": True,
        "blocked_until": (now - timedelta(hours=1)).isoformat(),
    }
    update_one = AsyncMock()
    db = SimpleNamespace(segments=SimpleNamespace(update_one=update_one))

    asyncio.run(auto_unblock_if_needed(db, segment, now))

    db.segments.update_one.assert_awaited_once_with(
        {"_id": segment_id},
        {"$set": {"blocked": False, "blocked_until": None}},
    )
    assert segment["blocked"] is False
    assert segment["blocked_until"] is None


@pytest.mark.unit
def test_auto_unblock_if_needed_ignores_invalid_date_values():
    segment = {"_id": ObjectId(), "blocked": True, "blocked_until": "not-an-iso-date"}
    update_one = AsyncMock()
    db = SimpleNamespace(segments=SimpleNamespace(update_one=update_one))

    asyncio.run(auto_unblock_if_needed(db, segment, datetime.now(timezone.utc)))

    db.segments.update_one.assert_not_awaited()
    assert segment["blocked"] is True
