import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import services.strava as strava_service
from tests.helpers import MockAsyncClientContext


@pytest.mark.unit
def test_get_strava_access_token_success(monkeypatch):
    mock_client = SimpleNamespace(
        post=AsyncMock(return_value=SimpleNamespace(status_code=200, json=lambda: {"access_token": "abc123"}))
    )
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    token = asyncio.run(strava_service.get_strava_access_token())
    assert token == "abc123"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("grade_field", "grade_value", "expected_gradient_pct"),
    [
        pytest.param("average_grade", 3.26, 3.3, id="average_grade"),
        pytest.param("avg_grade", 4.04, 4.0, id="avg_grade-fallback"),
    ],
)
def test_fetch_segment_details_returns_normalized_payload(monkeypatch, grade_field, grade_value, expected_gradient_pct):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="token-1"))
    segment_response = SimpleNamespace(
        status_code=200,
        json=lambda: {"map": {"polyline": "xyz"}, "name": "Segment A", "distance": 1234, grade_field: grade_value},
    )
    streams_response = SimpleNamespace(
        status_code=200,
        json=lambda: {
            "distance": {"data": [0, 50, 100, 150, 200]},
            "altitude": {"data": [400, 402, 404, 406, 408]},
        },
    )
    mock_client = SimpleNamespace(get=AsyncMock(side_effect=[segment_response, streams_response]))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    details = asyncio.run(strava_service.fetch_segment_details("42"))

    assert mock_client.get.await_args_list[0].args == ("https://www.strava.com/api/v3/segments/42",)
    assert mock_client.get.await_args_list[1].args == ("https://www.strava.com/api/v3/segments/42/streams",)
    assert mock_client.get.await_args_list[1].kwargs["params"] == {"keys": "distance,altitude", "key_by_type": "true"}
    assert details == {
        "polyline": "xyz",
        "name": "Segment A",
        "distance_km": 1.23,
        "gradient_pct": expected_gradient_pct,
        "elevation_profile": [[0.0, 400.0], [100.0, 404.0], [200.0, 408.0]],
    }


@pytest.mark.unit
def test_fetch_segment_details_keeps_segment_when_streams_fail(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="token-1"))
    segment_response = SimpleNamespace(
        status_code=200,
        json=lambda: {"map": {"polyline": "xyz"}, "name": "Segment A", "distance": 1234, "average_grade": 3.26},
    )
    mock_client = SimpleNamespace(get=AsyncMock(side_effect=[segment_response, SimpleNamespace(status_code=429, text="limit")]))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    details = asyncio.run(strava_service.fetch_segment_details("42"))

    assert details["name"] == "Segment A"
    assert details["elevation_profile"] is None


@pytest.mark.unit
def test_build_elevation_profile_resamples_to_about_100m():
    distances = [1000 + i * 7 for i in range(144)]  # 1001 m of stream, irregular 7 m spacing
    altitudes = [500 + i * 0.35 for i in range(144)]  # steady 5 %

    profile = strava_service.build_elevation_profile(distances, altitudes)

    assert profile[0] == [0.0, 500.0]
    assert len(profile) == 11
    assert profile[-1][0] == pytest.approx(1001.0)
    assert profile[-1][1] == pytest.approx(500 + 143 * 0.35, abs=0.1)
    grades = [(b[1] - a[1]) / (b[0] - a[0]) for a, b in zip(profile, profile[1:])]
    assert all(g == pytest.approx(0.05, abs=0.002) for g in grades)


@pytest.mark.unit
def test_build_elevation_profile_rejects_unusable_streams():
    assert strava_service.build_elevation_profile(None, [1, 2]) is None
    assert strava_service.build_elevation_profile([0, 10], [1]) is None
    assert strava_service.build_elevation_profile([0], [1]) is None
    assert strava_service.build_elevation_profile([5, 5], [1, 2]) is None


@pytest.mark.unit
def test_fetch_starred_segments_returns_normalized_payload(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="athlete-token"))
    mock_response = SimpleNamespace(
        status_code=200,
        json=lambda: [
            {"id": 42, "name": "Hawk Hill", "distance": 2684.8, "elev_difference": 152.8},
            {"id": 43, "name": "Flat Road", "distance": 5000},
        ],
    )
    mock_client = SimpleNamespace(get=AsyncMock(return_value=mock_response))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    result = asyncio.run(strava_service.fetch_starred_segments(SimpleNamespace(), "actor-123"))

    mock_client.get.assert_awaited_once_with(
        "https://www.strava.com/api/v3/segments/starred",
        headers={"Authorization": "Bearer athlete-token"},
        params={"page": 1, "per_page": 100},
    )
    assert result == [
        {"id": "42", "name": "Hawk Hill", "distance_km": 2.68, "elevation_m": 153},
        {"id": "43", "name": "Flat Road", "distance_km": 5.0, "elevation_m": None},
    ]


@pytest.mark.unit
def test_fetch_starred_segments_returns_none_when_strava_request_fails(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="athlete-token"))
    mock_client = SimpleNamespace(
        get=AsyncMock(return_value=SimpleNamespace(status_code=500, text="upstream failed", json=lambda: {}))
    )
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    assert asyncio.run(strava_service.fetch_starred_segments(SimpleNamespace(), "actor-123")) is None


@pytest.mark.unit
def test_exclude_existing_segments_checks_ids_aliases_and_legacy_urls():
    starred = [
        {"id": "11", "name": "New"},
        {"id": "22", "name": "Direct match"},
        {"id": "33", "name": "Alias match"},
        {"id": "44", "name": "URL match"},
    ]
    existing = [
        {"strava_id": "22", "aliases": []},
        {"strava_id": "99", "aliases": ["33"]},
        {"strava_url": "https://www.strava.com/segments/44?source=legacy"},
    ]

    assert strava_service.exclude_existing_segments(starred, existing) == [{"id": "11", "name": "New"}]


@pytest.mark.unit
def test_remember_and_sort_starred_segments_puts_newly_seen_ids_first():
    sightings_cursor = SimpleNamespace(
        to_list=AsyncMock(return_value=[
            {"segment_id": "old", "first_seen_at": "2026-08-01T10:00:00+00:00"},
            {"segment_id": "newer", "first_seen_at": "2026-09-01T10:00:00+00:00"},
        ])
    )
    sightings = SimpleNamespace(
        find=lambda *_args, **_kwargs: sightings_cursor,
        bulk_write=AsyncMock(),
    )
    segments = [
        {"id": "old", "name": "Old"},
        {"id": "brand-new", "name": "Brand new"},
        {"id": "newer", "name": "Newer"},
    ]

    result = asyncio.run(strava_service.remember_and_sort_starred_segments(
        SimpleNamespace(starred_segment_sightings=sightings),
        "actor-123",
        segments,
    ))

    assert [segment["id"] for segment in result] == ["brand-new", "newer", "old"]
    operations = sightings.bulk_write.await_args.args[0]
    assert len(operations) == 1
    assert operations[0]._filter == {"actor_id": "actor-123", "segment_id": "brand-new"}


@pytest.mark.unit
def test_remember_and_sort_starred_segments_preserves_initial_strava_order():
    sightings_cursor = SimpleNamespace(to_list=AsyncMock(return_value=[]))
    sightings = SimpleNamespace(
        find=lambda *_args, **_kwargs: sightings_cursor,
        bulk_write=AsyncMock(),
    )
    segments = [{"id": "2"}, {"id": "1"}, {"id": "3"}]

    result = asyncio.run(strava_service.remember_and_sort_starred_segments(
        SimpleNamespace(starred_segment_sightings=sightings),
        "actor-123",
        segments,
    ))

    assert [segment["id"] for segment in result] == ["2", "1", "3"]


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


@pytest.mark.unit
def test_fetch_segment_id_from_effort_returns_segment_id(monkeypatch):
    monkeypatch.setattr(strava_service, "get_strava_access_token", AsyncMock(return_value="token-1"))
    mock_response = SimpleNamespace(status_code=200, json=lambda: {"segment": {"id": 777}})
    mock_client = SimpleNamespace(get=AsyncMock(return_value=mock_response))
    monkeypatch.setattr(strava_service.httpx, "AsyncClient", lambda: MockAsyncClientContext(mock_client))

    segment_id = asyncio.run(strava_service.fetch_segment_id_from_effort("3465746799772048188"))
    assert segment_id == "777"


@pytest.mark.unit
def test_resolve_segment_id_from_strava_url_supports_segment_effort_urls(monkeypatch):
    fetch_mock = AsyncMock(return_value="888")
    monkeypatch.setattr(strava_service, "fetch_segment_id_from_effort", fetch_mock)

    direct = asyncio.run(strava_service.resolve_segment_id_from_strava_url("https://www.strava.com/segments/123"))
    resolved = asyncio.run(
        strava_service.resolve_segment_id_from_strava_url(
            "https://www.strava.com/activities/19268839605/segments/3511011627260237700"
        )
    )
    invalid = asyncio.run(strava_service.resolve_segment_id_from_strava_url("https://www.strava.com/routes/42"))

    assert direct == "123"
    assert resolved == "888"
    assert invalid is None
    fetch_mock.assert_awaited_once_with("3511011627260237700", db=None, actor_id=None)
