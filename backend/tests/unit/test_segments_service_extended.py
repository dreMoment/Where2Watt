import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId

from services.segments import enrich_admin_segment_users


class FindCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, length=None):
        return self.items


@pytest.mark.unit
def test_enrich_admin_segment_users_dedupes_reporters_and_sets_summaries():
    segment_id = ObjectId()
    segments = [{"_id": segment_id, "submitted_by_actor_id": "submitter-1"}]
    reports = [
        {"segment_id": segment_id, "reported_by_actor_id": "actor-a", "reported_at": "2026-03-05T10:00:00+00:00", "action": "blocked", "note": "Roadworks"},
        {"segment_id": segment_id, "reported_by_actor_id": "actor-a", "reported_at": "2026-03-05T09:00:00+00:00", "action": "blocked", "note": "Same"},
        {"segment_id": segment_id, "reported_by_actor_id": "actor-b", "reported_at": "2026-03-05T08:00:00+00:00", "action": "unblocked", "note": ""},
        {"segment_id": segment_id, "reported_by_actor_id": "", "reported_at": "2026-03-05T07:00:00+00:00", "action": "blocked", "note": "ignored"},
    ]
    def find(*_args, **_kwargs):
        return FindCursor(reports)

    db = SimpleNamespace(segment_block_reports=SimpleNamespace(find=find))

    asyncio.run(enrich_admin_segment_users(db, segments))

    assert segments[0]["reported_by_actor_ids"] == ["actor-a", "actor-b"]
    assert segments[0]["submitted_by_user"] == {"actor_id": "submitter-1"}
    assert segments[0]["reported_by_users"] == [{"actor_id": "actor-a"}, {"actor_id": "actor-b"}]
    assert len(segments[0]["block_reports"]) == 3
    assert segments[0]["block_reports"][0]["note"] == "Roadworks"
