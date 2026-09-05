import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from schemas import SegmentCreateSchema
from services.segments import (
    canonical_strava_segment_url,
    extract_segment_effort_id,
    extract_strava_id,
    normalize_aliases,
    parse_object_id,
    segment_identity_query,
    serialize_segment,
)


@pytest.mark.unit
def test_extract_strava_id_from_valid_url():
    url = "https://www.strava.com/segments/123456"
    assert extract_strava_id(url) == "123456"


@pytest.mark.unit
def test_extract_strava_id_returns_none_for_invalid_url():
    assert extract_strava_id("https://www.strava.com/routes/123") is None
    assert extract_strava_id("https://www.strava.com/activities/17650152462/segments/3465746799772048188") is None
    assert extract_strava_id("") is None


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/segments/123456",
        "https://www.strava.com.evil.example/segments/123456",
        "https://user@www.strava.com/segments/123456",
        "https://www.strava.com:443/segments/123456",
        "https://www.strava.com/segments/123456/extra",
        "javascript://www.strava.com/segments/123456",
    ],
)
def test_extract_strava_id_rejects_untrusted_or_malformed_urls(url):
    assert extract_strava_id(url) is None


@pytest.mark.unit
def test_strava_segment_helpers_canonicalize_and_build_legacy_lookup():
    assert canonical_strava_segment_url("123") == "https://www.strava.com/segments/123"
    assert segment_identity_query("123") == {
        "$or": [
            {"strava_id": "123"},
            {"aliases": "123"},
            {"strava_url": {"$regex": r"/segments/123(?:$|[/?#])"}},
        ]
    }


@pytest.mark.unit
def test_extract_segment_effort_id_from_activity_segment_effort_url():
    url = "https://www.strava.com/activities/19268839605/segments/3511011627260237700"
    assert extract_segment_effort_id(url) == "3511011627260237700"


@pytest.mark.unit
def test_extract_segment_effort_id_returns_none_for_non_effort_urls():
    assert extract_segment_effort_id("https://www.strava.com/segments/123456") is None
    assert extract_segment_effort_id("https://www.strava.com/routes/123") is None


@pytest.mark.unit
def test_parse_object_id_valid():
    value = str(ObjectId())
    parsed = parse_object_id(value)
    assert str(parsed) == value


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
def test_serialize_segment_includes_default_rating_stats():
    obj_id = ObjectId()
    segment = {"_id": obj_id, "name": "No Ratings Yet"}

    result = serialize_segment(segment)

    assert result["ratings_count"] == 0
    assert result["average_ratings"]["overall_quality"] is None


@pytest.mark.unit
def test_serialize_segment_uses_existing_average_ratings():
    obj_id = ObjectId()
    segment = {
        "_id": obj_id,
        "name": "Rated Segment",
        "ratings_count": 2,
        "average_ratings": {
            "overall_quality": 4.5,
            "traffic_level": 2.5,
            "road_surface": 2.0,
            "gradient_profile": 1.5,
            "sketchy_left_turns": 1.0,
        },
    }

    result = serialize_segment(segment)

    assert result["average_ratings"]["overall_quality"] == 4.5
    assert result["average_ratings"]["traffic_level"] == 2.5


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
