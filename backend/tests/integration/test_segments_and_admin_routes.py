from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock

import pytest
from bson import ObjectId

from dependencies import actor_id_from_strava_id, create_jwt
from schemas import SEGMENT_REPORT_NOTE_MAX_LENGTH
from tests.helpers import FindCursor, rating_totals_aggregate

DEFAULT_RATINGS = {
    "overall_quality": 4,
    "traffic_level": 2,
    "road_surface": 3,
    "gradient_profile": 2,
    "sketchy_left_turns": 1,
}


pytestmark = pytest.mark.usefixtures("disable_rate_limiter")


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
            find_one=AsyncMock(return_value=None),
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=created_id)),
        ),
        segment_ratings=SimpleNamespace(
            update_one=AsyncMock(return_value=SimpleNamespace(upserted_id=ObjectId())),
            aggregate=rating_totals_aggregate(DEFAULT_RATINGS),
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
    monkeypatch.setattr(segments_router, "resolve_segment_id_from_strava_url", AsyncMock(return_value="123"))
    notify_mock = AsyncMock()
    monkeypatch.setattr(segments_router, "notify_new_segment_submission", notify_mock)

    response = app_client.post(
        "/api/segments",
        json={
            "strava_url": "http://strava.com/segments/123?source=share",
            "safety_notes": "  Watch the gravel near the finish.  ",
            "ratings": DEFAULT_RATINGS,
        },
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
    assert body["status"] == "created"
    assert body["rating_status"] == "added"
    assert body["duplicate_reason"] is None
    db.segments.insert_one.assert_awaited_once()
    inserted_doc = db.segments.insert_one.await_args.args[0]
    assert inserted_doc["strava_id"] == "123"
    assert inserted_doc["strava_url"] == "https://www.strava.com/segments/123"
    assert inserted_doc["name"] == "Segment Name"
    assert inserted_doc["safety_notes"] == "Watch the gravel near the finish."
    assert inserted_doc["approved"] is False
    assert "submitted_by_actor_id" not in inserted_doc
    assert "ratings_count" not in inserted_doc
    assert "rating_totals" not in inserted_doc
    db.segment_ratings.update_one.assert_awaited_once_with(
        {"segment_id": created_id, "rated_by_actor_id": actor_id},
        {
            "$set": {"ratings": DEFAULT_RATINGS, "rated_at": ANY},
            "$setOnInsert": {"segment_id": created_id, "rated_by_actor_id": actor_id},
        },
        upsert=True,
    )
    notify_mock.assert_awaited_once_with(
        strava_url="https://www.strava.com/segments/123",
        strava_id="123",
        segment_name="Segment Name",
        submitted_by_actor_id=actor_id,
        created_at=ANY,
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
                            "reported_by_actor_ids": ["actor-reporter"],
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
def test_create_segment_for_existing_segment_records_rating_and_reports_under_review(monkeypatch, app_client):
    import routers.segments as segments_router

    existing_segment_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                return_value={
                    "_id": existing_segment_id,
                    "strava_id": "123",
                    "strava_url": "https://www.strava.com/segments/123",
                    "approved": False,
                }
            )
        ),
        segment_ratings=SimpleNamespace(
            update_one=AsyncMock(return_value=SimpleNamespace(upserted_id=ObjectId())),
            aggregate=rating_totals_aggregate(DEFAULT_RATINGS),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)
    monkeypatch.setattr(segments_router, "fetch_segment_details", AsyncMock(return_value=None))
    monkeypatch.setattr(segments_router, "resolve_segment_id_from_strava_url", AsyncMock(return_value="123"))

    response = app_client.post(
        "/api/segments",
        json={"strava_url": "https://www.strava.com/segments/123", "ratings": DEFAULT_RATINGS},
        headers=user_auth_headers(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "existing"
    assert payload["duplicate_reason"] == "under_review"
    assert payload["rating_status"] == "added"
    duplicate_query = db.segments.find_one.await_args.args[0]
    assert {"aliases": "123"} in duplicate_query["$or"]
    db.segment_ratings.update_one.assert_awaited_once_with(
        {"segment_id": existing_segment_id, "rated_by_actor_id": actor_id},
        {
            "$set": {"ratings": DEFAULT_RATINGS, "rated_at": ANY},
            "$setOnInsert": {"segment_id": existing_segment_id, "rated_by_actor_id": actor_id},
        },
        upsert=True,
    )


@pytest.mark.integration
@pytest.mark.parametrize(
    ("resolved_segment_id", "details"),
    [
        pytest.param(None, None, id="unresolvable-url"),
        pytest.param("123", None, id="strava-details-unavailable"),
    ],
)
def test_create_segment_rejects_when_segment_cannot_be_resolved(monkeypatch, app_client, resolved_segment_id, details):
    import routers.segments as segments_router

    db = SimpleNamespace(
        segments=SimpleNamespace(find_one=AsyncMock(return_value=None), insert_one=AsyncMock()),
        segment_ratings=SimpleNamespace(update_one=AsyncMock()),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)
    monkeypatch.setattr(segments_router, "resolve_segment_id_from_strava_url", AsyncMock(return_value=resolved_segment_id))
    monkeypatch.setattr(segments_router, "fetch_segment_details", AsyncMock(return_value=details))

    response = app_client.post(
        "/api/segments",
        json={"strava_url": "https://www.strava.com/segments/123", "ratings": DEFAULT_RATINGS},
        headers=user_auth_headers(),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Something went wrong. Please check if the Strava URL is correct."
    db.segments.insert_one.assert_not_awaited()
    db.segment_ratings.update_one.assert_not_awaited()


@pytest.mark.integration
def test_rate_segment_accepts_first_rating_and_updates_existing(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": segment_id},
                    {"_id": segment_id},
                    {"_id": segment_id},
                ]
            ),
        ),
        segment_ratings=SimpleNamespace(
            find_one=AsyncMock(return_value={"ratings": DEFAULT_RATINGS, "rated_at": "2026-03-06T10:00:00+00:00"}),
            update_one=AsyncMock(
                side_effect=[
                    SimpleNamespace(upserted_id=ObjectId()),
                    SimpleNamespace(upserted_id=None),
                ]
            ),
            aggregate=rating_totals_aggregate(DEFAULT_RATINGS),
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
    first_upsert = db.segment_ratings.update_one.await_args_list[0]
    assert first_upsert.args[0] == {"segment_id": segment_id, "rated_by_actor_id": actor_id}
    assert first_upsert.args[1]["$set"]["ratings"] == DEFAULT_RATINGS
    assert first_upsert.kwargs == {"upsert": True}
    updated_ratings = {
        **DEFAULT_RATINGS,
        "overall_quality": 9,
    }
    second = app_client.post(
        f"/api/segments/{segment_id}/ratings",
        json=updated_ratings,
        headers=user_auth_headers(),
    )
    assert second.status_code == 200
    assert second.json()["status"] == "rated"
    assert db.segment_ratings.update_one.await_count == 2
    update_set = db.segment_ratings.update_one.await_args_list[1].args[1]["$set"]
    assert update_set["ratings"] == updated_ratings
    assert "rated_at" in update_set

    my_status = app_client.get(f"/api/segments/{segment_id}/my-rating-status", headers=user_auth_headers())
    assert my_status.status_code == 200
    assert my_status.json()["has_rated"] is True
    assert my_status.json()["rating"] == DEFAULT_RATINGS


@pytest.mark.integration
def test_delete_my_segment_rating_deletes_only_current_user_rating(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(return_value={"_id": segment_id}),
        ),
        segment_ratings=SimpleNamespace(
            delete_one=AsyncMock(side_effect=[SimpleNamespace(deleted_count=1), SimpleNamespace(deleted_count=0)]),
            aggregate=rating_totals_aggregate({}, ratings_count=0),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    deleted = app_client.delete(
        f"/api/segments/{segment_id}/ratings",
        headers=user_auth_headers(),
    )
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"
    assert deleted.json()["ratings_count"] == 0
    assert deleted.json()["average_ratings"] == {
        "overall_quality": None,
        "traffic_level": None,
        "road_surface": None,
        "gradient_profile": None,
        "sketchy_left_turns": None,
    }
    db.segment_ratings.delete_one.assert_awaited_with({"segment_id": segment_id, "rated_by_actor_id": actor_id})

    missing = app_client.delete(
        f"/api/segments/{segment_id}/ratings",
        headers=user_auth_headers(),
    )
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Rating not found"


@pytest.mark.integration
@pytest.mark.parametrize(
    ("action", "currently_blocked", "note"),
    [
        pytest.param("blocked", False, "Roadworks until next week", id="report-blocked"),
        pytest.param("unblocked", True, "Road has reopened", id="report-unblocked"),
    ],
)
def test_report_segment_records_note_and_dedupes_repeat_reports(monkeypatch, app_client, action, currently_blocked, note):
    # The DuplicateKeyError race fallback (routers/segments.py insert_one except-branch) is not covered here.
    import routers.segments as segments_router

    segment_id = ObjectId()
    actor_id = actor_id_from_strava_id(12345)
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(return_value={"_id": segment_id, "blocked": currently_blocked}),
        ),
        segment_block_reports=SimpleNamespace(
            find_one=AsyncMock(side_effect=[None, {"segment_id": segment_id}]),
            insert_one=AsyncMock(),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    first = app_client.post(
        f"/api/segments/{segment_id}/report-{action}",
        json={"note": note},
        headers=user_auth_headers(),
    )
    assert first.status_code == 200
    assert first.json() == {"status": "reported", "action": action, "blocked": currently_blocked}
    inserted = db.segment_block_reports.insert_one.await_args.args[0]
    assert inserted["action"] == action
    assert inserted["note"] == note
    assert inserted["reported_by_actor_id"] == actor_id

    second = app_client.post(
        f"/api/segments/{segment_id}/report-{action}",
        json={},
        headers=user_auth_headers(),
    )
    assert second.status_code == 200
    assert second.json()["status"] == "already_reported"
    assert second.json()["action"] == action
    assert db.segment_block_reports.insert_one.await_count == 1


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
def test_report_endpoint_rejects_too_long_note(app_client):
    segment_id = ObjectId()
    note = "x" * (SEGMENT_REPORT_NOTE_MAX_LENGTH + 1)

    res = app_client.post(
        f"/api/segments/{segment_id}/report-blocked",
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
    admin_actor_id = actor_id_from_strava_id(987654)
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
    resolve_mock = AsyncMock(side_effect=[None, "111", "222"])
    monkeypatch.setattr(
        admin_router,
        "resolve_segment_id_from_strava_url",
        resolve_mock,
    )
    fetch_mock = AsyncMock(return_value={"name": "Admin Segment", "polyline": "poly", "distance_km": 2.2, "gradient_pct": 5.1})
    monkeypatch.setattr(
        admin_router,
        "fetch_segment_details",
        fetch_mock,
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
    resolve_mock.assert_awaited_with("https://www.strava.com/segments/222", db=db, actor_id=admin_actor_id)
    fetch_mock.assert_awaited_once_with("222", db=db, actor_id=admin_actor_id)


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
        json={"message": "Closed for race event"},
        headers=admin_auth_headers(),
    )
    assert block.status_code == 200
    assert block.json() == {"status": "blocked", "block_message": "Closed for race event"}

    db.segments.update_one.assert_any_await(
        {"_id": segment_id},
        {"$set": {"blocked": True, "block_message": "Closed for race event"}},
    )

    unblock = app_client.patch(f"/api/admin/segments/{segment_id}/unblock", headers=admin_auth_headers())
    assert unblock.status_code == 200
    assert unblock.json() == {"status": "unblocked"}
    db.segments.update_one.assert_any_await({"_id": segment_id}, {"$set": {"blocked": False, "block_message": None}})
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
            aggregate=rating_totals_aggregate(
                {"overall_quality": 8, "traffic_level": 4, "road_surface": 5, "gradient_profile": 4, "sketchy_left_turns": 2},
                ratings_count=2,
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


@pytest.mark.integration
def test_admin_merge_segment_moves_ratings_and_carries_aliases(monkeypatch, app_client):
    import routers.admin as admin_router

    source_segment_id = ObjectId()
    target_segment_id = ObjectId()
    source_rating_1 = ObjectId()
    source_rating_2 = ObjectId()

    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": source_segment_id, "strava_id": "111", "aliases": ["444", "555"]},
                    {"_id": target_segment_id, "strava_id": "222", "aliases": ["333", "444"]},
                ]
            ),
            update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)),
            delete_one=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
        ),
        segment_ratings=SimpleNamespace(
            find=Mock(
                side_effect=[
                    FindCursor(
                        [
                            {"_id": source_rating_1, "segment_id": source_segment_id, "rated_by_actor_id": "actor-1"},
                            {"_id": source_rating_2, "segment_id": source_segment_id, "rated_by_actor_id": "actor-2"},
                        ]
                    ),
                    FindCursor([]),
                ]
            ),
            delete_one=AsyncMock(),
            update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        ),
        segment_block_reports=SimpleNamespace(delete_many=AsyncMock()),
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)

    response = app_client.post(
        f"/api/admin/segments/{source_segment_id}/merge",
        json={"target_segment_id": str(target_segment_id)},
        headers=admin_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "merged",
        "merged_from_segment_id": str(source_segment_id),
        "merged_into_segment_id": str(target_segment_id),
        "moved_ratings": 2,
        "aliases": ["333", "444", "111", "555"],
    }
    db.segment_ratings.delete_one.assert_not_awaited()
    db.segment_ratings.update_one.assert_any_await(
        {"_id": source_rating_1, "segment_id": source_segment_id},
        {"$set": {"segment_id": target_segment_id}},
    )
    db.segment_ratings.update_one.assert_any_await(
        {"_id": source_rating_2, "segment_id": source_segment_id},
        {"$set": {"segment_id": target_segment_id}},
    )
    db.segments.update_one.assert_awaited_once_with(
        {"_id": target_segment_id},
        {"$set": {"aliases": ["333", "444", "111", "555"]}},
    )
    db.segments.delete_one.assert_awaited_once_with({"_id": source_segment_id})
    db.segment_block_reports.delete_many.assert_awaited_once_with({"segment_id": source_segment_id})


@pytest.mark.integration
def test_admin_merge_segment_keeps_target_rating_when_actor_exists_on_both_segments(monkeypatch, app_client):
    import routers.admin as admin_router

    source_segment_id = ObjectId()
    target_segment_id = ObjectId()
    source_rating_1 = ObjectId()
    source_rating_2 = ObjectId()

    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": source_segment_id, "strava_id": "111", "aliases": []},
                    {"_id": target_segment_id, "strava_id": "222", "aliases": []},
                ]
            ),
            update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)),
            delete_one=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
        ),
        segment_ratings=SimpleNamespace(
            find=Mock(
                side_effect=[
                    FindCursor(
                        [
                            {"_id": source_rating_1, "segment_id": source_segment_id, "rated_by_actor_id": "actor-1"},
                            {"_id": source_rating_2, "segment_id": source_segment_id, "rated_by_actor_id": "actor-2"},
                        ]
                    ),
                    FindCursor([{"rated_by_actor_id": "actor-1"}]),
                ]
            ),
            delete_one=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
            update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        ),
        segment_block_reports=SimpleNamespace(delete_many=AsyncMock()),
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)

    response = app_client.post(
        f"/api/admin/segments/{source_segment_id}/merge",
        json={"target_segment_id": str(target_segment_id)},
        headers=admin_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json()["moved_ratings"] == 1
    db.segment_ratings.delete_one.assert_awaited_once_with({"_id": source_rating_1, "segment_id": source_segment_id})
    db.segment_ratings.update_one.assert_awaited_once_with(
        {"_id": source_rating_2, "segment_id": source_segment_id},
        {"$set": {"segment_id": target_segment_id}},
    )


@pytest.mark.integration
def test_admin_split_segment_creates_alias_segments_and_clears_aliases(monkeypatch, app_client):
    import routers.admin as admin_router

    source_segment_id = ObjectId()
    created_segment_id = ObjectId()
    admin_actor_id = actor_id_from_strava_id(987654)

    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    {"_id": source_segment_id, "strava_id": "999", "aliases": ["111", "222"], "approved": True, "blocked": False},
                    {
                        "_id": created_segment_id,
                        "strava_id": "111",
                        "strava_url": "https://www.strava.com/segments/111",
                        "name": "Alias Segment",
                        "polyline": "poly-111",
                        "distance_km": 1.8,
                        "gradient_pct": 3.2,
                        "approved": True,
                        "blocked": False,
                        "aliases": [],
                        "created_at": "2026-03-12T12:00:00+00:00",
                    },
                ]
            ),
            find=Mock(return_value=FindCursor([{"_id": ObjectId(), "strava_id": "222"}])),
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=created_segment_id)),
            update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)),
        )
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)
    fetch_mock = AsyncMock(return_value={"name": "Alias Segment", "polyline": "poly-111", "distance_km": 1.8, "gradient_pct": 3.2})
    monkeypatch.setattr(
        admin_router,
        "fetch_segment_details",
        fetch_mock,
    )

    response = app_client.post(
        f"/api/admin/segments/{source_segment_id}/split",
        headers=admin_auth_headers(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "split"
    assert payload["source_segment_id"] == str(source_segment_id)
    assert payload["skipped_aliases"] == ["222"]
    assert len(payload["created_segments"]) == 1
    assert payload["created_segments"][0]["id"] == str(created_segment_id)
    assert payload["created_segments"][0]["strava_id"] == "111"
    assert payload["created_segments"][0]["ratings_count"] == 0
    inserted_doc = db.segments.insert_one.await_args.args[0]
    assert inserted_doc["strava_id"] == "111"
    assert inserted_doc["strava_url"] == "https://www.strava.com/segments/111"
    assert inserted_doc["aliases"] == []
    fetch_mock.assert_awaited_once_with("111", db=db, actor_id=admin_actor_id)
    db.segments.update_one.assert_awaited_once_with({"_id": source_segment_id}, {"$set": {"aliases": []}})
