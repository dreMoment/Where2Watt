from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock

import pytest
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from dependencies import actor_id_from_strava_id, create_jwt
from schemas import SEGMENT_REPORT_NOTE_MAX_LENGTH

DEFAULT_RATINGS = {
    "overall_quality": 4,
    "traffic_level": 2,
    "road_surface": 3,
    "gradient_profile": 2,
    "sketchy_left_turns": 1,
}


class FindCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None, **_kwargs):
        return self.items


@pytest.fixture(autouse=True)
def disable_rate_limiter():
    from main import app

    app.state.limiter.enabled = False
    yield
    app.state.limiter.enabled = True


def user_auth_headers(strava_id: int = 12345) -> dict[str, str]:
    actor_id = actor_id_from_strava_id(strava_id)
    token = create_jwt(actor_id=actor_id, is_admin=False)
    return {"Authorization": f"Bearer {token}"}


def admin_auth_headers() -> dict[str, str]:
    actor_id = actor_id_from_strava_id(987654)
    token = create_jwt(actor_id=actor_id, is_admin=True)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
def test_create_segment_enriches_with_strava_details(monkeypatch, app_client):
    import routers.segments as segments_router

    created_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    None,
                    {
                        "_id": created_id,
                        "strava_url": "https://www.strava.com/segments/123",
                        "approved": False,
                    },
                ]
            ),
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=created_id)),
        ),
        segment_ratings=SimpleNamespace(
            insert_one=AsyncMock(),
            aggregate=Mock(
                return_value=FindCursor(
                    [
                        {
                            "ratings_count": 1,
                            "overall_quality_total": DEFAULT_RATINGS["overall_quality"],
                            "traffic_level_total": DEFAULT_RATINGS["traffic_level"],
                            "road_surface_total": DEFAULT_RATINGS["road_surface"],
                            "gradient_profile_total": DEFAULT_RATINGS["gradient_profile"],
                            "sketchy_left_turns_total": DEFAULT_RATINGS["sketchy_left_turns"],
                        }
                    ]
                )
            ),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)
    monkeypatch.setattr(
        segments_router,
        "fetch_segment_details",
        AsyncMock(
            return_value={
                "polyline": "polyline-1",
                "name": "Segment Name",
                "distance_km": 1.2,
                "gradient_pct": 4.5,
            }
        ),
    )

    response = app_client.post(
        "/api/segments",
        json={"strava_url": "https://www.strava.com/segments/123", "ratings": DEFAULT_RATINGS},
        headers=user_auth_headers(),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == str(created_id)
    assert "submitted_by_actor_id" not in body
    assert "reported_by_actor_ids" not in body
    assert "submitted_by_user" not in body
    assert "reported_by_users" not in body
    assert "block_reports" not in body
    db.segments.insert_one.assert_awaited_once()
    inserted_doc = db.segments.insert_one.await_args.args[0]
    assert inserted_doc["strava_id"] == "123"
    assert inserted_doc["name"] == "Segment Name"
    assert inserted_doc["approved"] is False
    assert "ratings_count" not in inserted_doc
    assert "rating_totals" not in inserted_doc
    db.segment_ratings.insert_one.assert_awaited_once_with(
        {
            "segment_id": created_id,
            "rated_by_actor_id": actor_id,
            "ratings": DEFAULT_RATINGS,
            "rated_at": ANY,
        }
    )


@pytest.mark.integration
def test_list_segments_hides_actor_ids_for_public_response(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find=Mock(
                return_value=FindCursor(
                    [
                        {
                            "_id": segment_id,
                            "name": "Hidden IDs Segment",
                            "approved": True,
                            "submitted_by_actor_id": "actor-submitter",
                            "reported_by_actor_ids": ["actor-reporter"],
                            "submitted_by_user": {"actor_id": "actor-submitter"},
                            "reported_by_users": [{"actor_id": "actor-reporter"}],
                            "block_reports": [
                                {
                                    "reported_by_actor_id": "actor-reporter",
                                    "reported_at": "2026-03-05T10:00:00+00:00",
                                    "action": "blocked",
                                    "note": "Roadworks",
                                }
                            ],
                        }
                    ]
                )
            )
        ),
        segment_ratings=SimpleNamespace(aggregate=Mock(return_value=FindCursor([]))),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    response = app_client.get("/api/segments")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(segment_id)
    assert "submitted_by_actor_id" not in payload[0]
    assert "reported_by_actor_ids" not in payload[0]
    assert "submitted_by_user" not in payload[0]
    assert "reported_by_users" not in payload[0]
    assert "block_reports" not in payload[0]


@pytest.mark.integration
def test_create_segment_rejects_duplicate(monkeypatch, app_client):
    import routers.segments as segments_router

    db = SimpleNamespace(segments=SimpleNamespace(find_one=AsyncMock(return_value={"_id": ObjectId()})))
    monkeypatch.setattr(segments_router, "get_db", lambda: db)
    monkeypatch.setattr(segments_router, "fetch_segment_details", AsyncMock(return_value=None))

    response = app_client.post(
        "/api/segments",
        json={"strava_url": "https://www.strava.com/segments/123", "ratings": DEFAULT_RATINGS},
        headers=user_auth_headers(),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Segment already exists"


@pytest.mark.integration
def test_create_segment_requires_ratings(app_client):
    response = app_client.post(
        "/api/segments",
        json={"strava_url": "https://www.strava.com/segments/123"},
        headers=user_auth_headers(),
    )

    assert response.status_code == 422


@pytest.mark.integration
def test_rate_segment_accepts_first_rating_and_rejects_duplicate(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": segment_id},
                    {"_id": segment_id},
                ]
            ),
        ),
        segment_ratings=SimpleNamespace(
            insert_one=AsyncMock(side_effect=[None, DuplicateKeyError("dup")]),
            aggregate=Mock(
                return_value=FindCursor(
                    [
                        {
                            "ratings_count": 1,
                            "overall_quality_total": DEFAULT_RATINGS["overall_quality"],
                            "traffic_level_total": DEFAULT_RATINGS["traffic_level"],
                            "road_surface_total": DEFAULT_RATINGS["road_surface"],
                            "gradient_profile_total": DEFAULT_RATINGS["gradient_profile"],
                            "sketchy_left_turns_total": DEFAULT_RATINGS["sketchy_left_turns"],
                        }
                    ]
                )
            ),
            find_one=AsyncMock(return_value={"ratings": DEFAULT_RATINGS, "rated_at": "2026-03-06T10:00:00+00:00"}),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    first = app_client.post(
        f"/api/segments/{segment_id}/ratings",
        json=DEFAULT_RATINGS,
        headers=user_auth_headers(),
    )
    assert first.status_code == 200
    assert first.json()["status"] == "rated"
    assert first.json()["ratings_count"] == 1
    assert first.json()["average_ratings"]["overall_quality"] == 4.0
    db.segment_ratings.insert_one.assert_awaited_once_with(
        {
            "segment_id": segment_id,
            "rated_by_actor_id": actor_id,
            "ratings": DEFAULT_RATINGS,
            "rated_at": ANY,
        }
    )
    second = app_client.post(
        f"/api/segments/{segment_id}/ratings",
        json=DEFAULT_RATINGS,
        headers=user_auth_headers(),
    )
    assert second.status_code == 409
    assert second.json()["detail"] == "You already rated this segment"

    my_status = app_client.get(f"/api/segments/{segment_id}/my-rating-status", headers=user_auth_headers())
    assert my_status.status_code == 200
    assert my_status.json()["has_rated"] is True
    assert my_status.json()["rating"] == DEFAULT_RATINGS


@pytest.mark.integration
def test_report_segment_blocked_uses_manual_queue_and_note(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(return_value={"_id": segment_id, "blocked": False}),
        ),
        segment_block_reports=SimpleNamespace(
            find_one=AsyncMock(side_effect=[None, {"segment_id": segment_id}]),
            insert_one=AsyncMock(side_effect=[None, DuplicateKeyError("dup")]),
            count_documents=AsyncMock(side_effect=[1, 1]),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    first = app_client.post(
        f"/api/segments/{segment_id}/report-blocked",
        json={"note": "Roadworks until next week"},
        headers=user_auth_headers(),
    )
    assert first.status_code == 200
    assert first.json()["status"] == "reported"
    assert first.json()["action"] == "blocked"
    assert first.json()["blocked"] is False

    second = app_client.post(
        f"/api/segments/{segment_id}/report-blocked",
        json={},
        headers=user_auth_headers(),
    )
    assert second.status_code == 200
    assert second.json()["status"] == "already_reported"
    assert second.json()["action"] == "blocked"
    assert db.segment_block_reports.insert_one.await_count == 1


@pytest.mark.integration
def test_report_segment_unblocked_requires_blocked_state_and_dedupes(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(side_effect=[{"_id": segment_id, "blocked": True}, {"_id": segment_id, "blocked": True}]),
        ),
        segment_block_reports=SimpleNamespace(
            find_one=AsyncMock(side_effect=[None, {"segment_id": segment_id}]),
            insert_one=AsyncMock(),
            count_documents=AsyncMock(side_effect=[2, 2]),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    first = app_client.post(
        f"/api/segments/{segment_id}/report-unblocked",
        json={"note": "Road has reopened"},
        headers=user_auth_headers(),
    )
    assert first.status_code == 200
    assert first.json()["status"] == "reported"
    assert first.json()["action"] == "unblocked"
    assert first.json()["blocked"] is True

    second = app_client.post(
        f"/api/segments/{segment_id}/report-unblocked",
        json={},
        headers=user_auth_headers(),
    )
    assert second.status_code == 200
    assert second.json()["status"] == "already_reported"
    assert second.json()["action"] == "unblocked"


@pytest.mark.integration
def test_report_endpoints_reject_wrong_segment_state(monkeypatch, app_client):
    import routers.segments as segments_router

    blocked_segment_id = ObjectId()
    free_segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": blocked_segment_id, "blocked": True},
                    {"_id": free_segment_id, "blocked": False},
                ]
            ),
        ),
        segment_block_reports=SimpleNamespace(
            find_one=AsyncMock(),
            insert_one=AsyncMock(),
            count_documents=AsyncMock(),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    blocked_res = app_client.post(
        f"/api/segments/{blocked_segment_id}/report-blocked",
        json={},
        headers=user_auth_headers(),
    )
    assert blocked_res.status_code == 409

    free_res = app_client.post(
        f"/api/segments/{free_segment_id}/report-unblocked",
        json={},
        headers=user_auth_headers(),
    )
    assert free_res.status_code == 409


@pytest.mark.integration
@pytest.mark.parametrize("path", ["report-blocked", "report-unblocked"])
def test_report_endpoints_reject_too_long_note(app_client, path):
    segment_id = ObjectId()
    note = "x" * (SEGMENT_REPORT_NOTE_MAX_LENGTH + 1)

    res = app_client.post(
        f"/api/segments/{segment_id}/{path}",
        json={"note": note},
        headers=user_auth_headers(),
    )

    assert res.status_code == 422


@pytest.mark.integration
def test_my_report_status_returns_has_reported_for_current_state(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(find_one=AsyncMock(return_value={"_id": segment_id, "blocked": False})),
        segment_block_reports=SimpleNamespace(
            find_one=AsyncMock(return_value={"action": "blocked", "reported_at": "2026-03-05T10:00:00+00:00", "note": "Works"})
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    res = app_client.get(f"/api/segments/{segment_id}/my-report-status", headers=user_auth_headers())
    assert res.status_code == 200
    assert res.json()["has_reported"] is True
    assert res.json()["expected_action"] == "blocked"
    db.segment_block_reports.find_one.assert_awaited_once_with(
        {"segment_id": segment_id, "reported_by_actor_id": actor_id, "action": "blocked"},
        {"_id": 0, "action": 1, "reported_at": 1, "note": 1},
    )


@pytest.mark.integration
def test_delete_segment_success_and_not_found(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(delete_one=AsyncMock(side_effect=[SimpleNamespace(deleted_count=1), SimpleNamespace(deleted_count=0)])),
        segment_block_reports=SimpleNamespace(delete_many=AsyncMock()),
        segment_ratings=SimpleNamespace(delete_many=AsyncMock()),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    ok = app_client.delete(f"/api/segments/{segment_id}", headers=admin_auth_headers())
    assert ok.status_code == 200
    assert ok.json() == {"status": "deleted"}
    db.segment_block_reports.delete_many.assert_awaited_once_with({"segment_id": segment_id})
    db.segment_ratings.delete_many.assert_awaited_once_with({"segment_id": segment_id})

    missing = app_client.delete(f"/api/segments/{segment_id}", headers=admin_auth_headers())
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Segment not found"


@pytest.mark.integration
def test_admin_quickadd_invalid_url_existing_and_success(monkeypatch, app_client):
    import routers.admin as admin_router

    created_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": ObjectId()},
                    None,
                    {"_id": created_id, "strava_id": "222", "approved": True, "strava_url": "https://www.strava.com/segments/222"},
                ]
            ),
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=created_id)),
        )
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)
    monkeypatch.setattr(
        admin_router,
        "fetch_segment_details",
        AsyncMock(return_value={"name": "Admin Segment", "polyline": "poly", "distance_km": 2.2, "gradient_pct": 5.1}),
    )

    invalid = app_client.post(
        "/api/admin/segments/quickadd",
        json={"strava_url": "https://www.strava.com/routes/123"},
        headers=admin_auth_headers(),
    )
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "Invalid Strava URL"

    duplicate = app_client.post(
        "/api/admin/segments/quickadd",
        json={"strava_url": "https://www.strava.com/segments/111"},
        headers=admin_auth_headers(),
    )
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "Segment already exists"

    success = app_client.post(
        "/api/admin/segments/quickadd",
        json={"strava_url": "https://www.strava.com/segments/222"},
        headers=admin_auth_headers(),
    )
    assert success.status_code == 201
    assert success.json()["id"] == str(created_id)
    assert db.segments.insert_one.await_count == 1
    inserted_doc = db.segments.insert_one.await_args.args[0]
    assert "ratings_count" not in inserted_doc


@pytest.mark.integration
def test_admin_segment_state_mutations_and_report_listing(monkeypatch, app_client):
    import routers.admin as admin_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(return_value={"_id": segment_id}),
            update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)),
        ),
        segment_block_reports=SimpleNamespace(
            find=Mock(
                return_value=FindCursor(
                    [
                        {
                            "reported_by_actor_id": "actor-1",
                            "reported_at": "2026-03-05T10:00:00+00:00",
                            "action": "blocked",
                            "note": "Temporary construction",
                        }
                    ]
                )
            ),
            delete_many=AsyncMock(),
        ),
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)

    approve = app_client.post(f"/api/admin/segments/{segment_id}/approve", headers=admin_auth_headers())
    assert approve.status_code == 200
    assert approve.json() == {"status": "approved"}

    block = app_client.patch(
        f"/api/admin/segments/{segment_id}/block",
        headers=admin_auth_headers(),
    )
    assert block.status_code == 200
    assert block.json() == {"status": "blocked"}

    unblock = app_client.patch(f"/api/admin/segments/{segment_id}/unblock", headers=admin_auth_headers())
    assert unblock.status_code == 200
    assert unblock.json() == {"status": "unblocked"}
    assert db.segment_block_reports.delete_many.await_count == 2
    db.segment_block_reports.delete_many.assert_any_await({"segment_id": segment_id})

    reports = app_client.get(f"/api/admin/segments/{segment_id}/blocked-reports", headers=admin_auth_headers())
    assert reports.status_code == 200
    assert reports.json()["reports_count"] == 1
    assert reports.json()["reports"][0]["reported_by_actor_id"] == "actor-1"
    assert reports.json()["reports"][0]["action"] == "blocked"
    assert reports.json()["reports"][0]["note"] == "Temporary construction"


@pytest.mark.integration
def test_admin_can_list_and_delete_segment_ratings(monkeypatch, app_client):
    import routers.admin as admin_router

    segment_id = ObjectId()
    rating_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(side_effect=[{"_id": segment_id}, {"_id": segment_id}]),
        ),
        segment_ratings=SimpleNamespace(
            find=Mock(
                return_value=FindCursor(
                    [
                        {
                            "_id": rating_id,
                            "segment_id": segment_id,
                            "rated_by_actor_id": "actor-1",
                            "rated_at": "2026-03-05T10:00:00+00:00",
                            "ratings": DEFAULT_RATINGS,
                        }
                    ]
                )
            ),
            find_one=AsyncMock(return_value={"_id": rating_id, "segment_id": segment_id}),
            delete_one=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
            aggregate=Mock(
                return_value=FindCursor(
                    [
                        {
                            "ratings_count": 2,
                            "overall_quality_total": 8,
                            "traffic_level_total": 4,
                            "road_surface_total": 5,
                            "gradient_profile_total": 4,
                            "sketchy_left_turns_total": 2,
                        }
                    ]
                )
            ),
        ),
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)

    listed = app_client.get(f"/api/admin/segments/{segment_id}/ratings", headers=admin_auth_headers())
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == str(rating_id)
    assert listed.json()[0]["rated_by_actor_id"] == "actor-1"
    assert listed.json()[0]["ratings"] == DEFAULT_RATINGS

    deleted = app_client.delete(f"/api/admin/segments/{segment_id}/ratings/{rating_id}", headers=admin_auth_headers())
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"
    assert deleted.json()["ratings_count"] == 2
    assert deleted.json()["average_ratings"] == {
        "overall_quality": 4.0,
        "traffic_level": 2.0,
        "road_surface": 2.5,
        "gradient_profile": 2.0,
        "sketchy_left_turns": 1.0,
    }
    db.segment_ratings.delete_one.assert_awaited_once_with({"_id": rating_id, "segment_id": segment_id})
