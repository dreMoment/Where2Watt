import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from schemas import SegmentCreateSchema
from services.segments import (
    enrich_admin_segment_users,
    extract_segment_effort_id,
    extract_strava_id,
    normalize_aliases,
    parse_object_id,
    serialize_segment,
)
from tests.helpers import FindCursor


@pytest.mark.unit
@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.strava.com/segments/123456", "123456"),
        ("https://www.strava.com/routes/123", None),
        ("https://www.strava.com/activities/17650152462/segments/3465746799772048188", None),
        ("", None),
        # Untrusted or malformed URLs must never yield an ID.
        ("https://example.com/segments/123456", None),
        ("https://www.strava.com.evil.example/segments/123456", None),
        ("https://user@www.strava.com/segments/123456", None),
        ("https://www.strava.com:443/segments/123456", None),
        ("https://www.strava.com/segments/123456/extra", None),
        ("javascript://www.strava.com/segments/123456", None),
    ],
)
def test_extract_strava_id(url, expected):
    assert extract_strava_id(url) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.strava.com/activities/19268839605/segments/3511011627260237700", "3511011627260237700"),
        ("https://www.strava.com/segments/123456", None),
        ("https://www.strava.com/routes/123", None),
    ],
)
def test_extract_segment_effort_id(url, expected):
    assert extract_segment_effort_id(url) == expected


@pytest.mark.unit
def test_parse_object_id_invalid_raises_http_400():
    with pytest.raises(HTTPException) as exc:
        parse_object_id("not-an-object-id")
    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid segment ID format"


@pytest.mark.unit
def test_serialize_segment_maps_id_and_preserves_fields():
    obj_id = ObjectId()
    segment = {"_id": obj_id, "name": "Test Segment", "approved": True}

    result = serialize_segment(segment)

    assert result["id"] == str(obj_id)
    assert "_id" not in result
    assert result["name"] == "Test Segment"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("stats", "expected_count", "expected_overall", "expected_traffic"),
    [
        pytest.param({}, 0, None, None, id="defaults-when-unrated"),
        pytest.param(
            {
                "ratings_count": 2,
                "average_ratings": {
                    "overall_quality": 4.5,
                    "traffic_level": 2.5,
                    "road_surface": 2.0,
                    "gradient_profile": 1.5,
                    "sketchy_left_turns": 1.0,
                },
            },
            2,
            4.5,
            2.5,
            id="uses-existing-averages",
        ),
    ],
)
def test_serialize_segment_rating_stats(stats, expected_count, expected_overall, expected_traffic):
    result = serialize_segment({"_id": ObjectId(), "name": "Segment", **stats})

    assert result["ratings_count"] == expected_count
    assert result["average_ratings"]["overall_quality"] == expected_overall
    assert result["average_ratings"]["traffic_level"] == expected_traffic


@pytest.mark.unit
def test_serialize_segment_normalizes_aliases_and_removes_canonical_strava_id():
    obj_id = ObjectId()
    segment = {
        "_id": obj_id,
        "strava_id": "123",
        "aliases": ["123", "456", "456", "789", ""],
    }

    result = serialize_segment(segment)

    assert result["aliases"] == ["456", "789"]


@pytest.mark.unit
def test_normalize_aliases_accepts_numeric_values_and_dedupes():
    aliases = normalize_aliases([123, "123", "456", None, " ", 789])
    assert aliases == ["123", "456", "789"]


@pytest.mark.unit
def test_segment_submission_rejects_client_supplied_strava_metadata():
    with pytest.raises(ValidationError):
        SegmentCreateSchema(
            strava_url="https://www.strava.com/segments/123",
            name="Forged name",
            ratings={
                "overall_quality": 8,
                "traffic_level": 1,
                "road_surface": 2,
                "gradient_profile": 2,
                "sketchy_left_turns": 0,
            },
        )


@pytest.mark.unit
def test_enrich_admin_segment_users_dedupes_reporters_and_sets_summaries():
    segment_id = ObjectId()
    segments = [{"_id": segment_id}]
    reports = [
        {"segment_id": segment_id, "reported_by_actor_id": "actor-a", "reported_at": "2026-03-05T10:00:00+00:00", "action": "blocked", "note": "Roadworks"},
        {"segment_id": segment_id, "reported_by_actor_id": "actor-a", "reported_at": "2026-03-05T09:00:00+00:00", "action": "blocked", "note": "Same"},
        {"segment_id": segment_id, "reported_by_actor_id": "actor-b", "reported_at": "2026-03-05T08:00:00+00:00", "action": "unblocked", "note": ""},
        {"segment_id": segment_id, "reported_by_actor_id": "", "reported_at": "2026-03-05T07:00:00+00:00", "action": "blocked", "note": "ignored"},
    ]
    db = SimpleNamespace(segment_block_reports=SimpleNamespace(find=lambda *_args, **_kwargs: FindCursor(reports)))

    asyncio.run(enrich_admin_segment_users(db, segments))

    assert segments[0]["reported_by_actor_ids"] == ["actor-a", "actor-b"]
    assert segments[0]["reported_by_users"] == [{"actor_id": "actor-a"}, {"actor_id": "actor-b"}]
    assert len(segments[0]["block_reports"]) == 3
    assert segments[0]["block_reports"][0]["note"] == "Roadworks"
