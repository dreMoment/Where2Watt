import pytest
from bson import ObjectId
from fastapi import HTTPException

from services.segments import extract_strava_id, parse_object_id, serialize_segment


@pytest.mark.unit
def test_extract_strava_id_from_valid_url():
    url = "https://www.strava.com/segments/123456"
    assert extract_strava_id(url) == "123456"


@pytest.mark.unit
def test_extract_strava_id_returns_none_for_invalid_url():
    assert extract_strava_id("https://www.strava.com/routes/123") is None
    assert extract_strava_id("") is None


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
    assert result["average_ratings"]["traffic"] is None


@pytest.mark.unit
def test_serialize_segment_uses_existing_average_ratings():
    obj_id = ObjectId()
    segment = {
        "_id": obj_id,
        "name": "Rated Segment",
        "ratings_count": 2,
        "average_ratings": {"traffic": 3.5, "steady_gradient": 4.5, "sketchy_left_turns": 2.5, "downhills": 4.0},
    }

    result = serialize_segment(segment)

    assert result["average_ratings"]["traffic"] == 3.5
    assert result["average_ratings"]["steady_gradient"] == 4.5
