from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from dependencies import actor_id_from_strava_id, create_jwt


class FindCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None):
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
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(
                side_effect=[
                    None,
                    {"_id": created_id, "strava_url": "https://www.strava.com/segments/123", "approved": False},
                ]
            ),
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=created_id)),
        )
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
        json={"strava_url": "https://www.strava.com/segments/123"},
        headers=user_auth_headers(),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == str(created_id)
    db.segments.insert_one.assert_awaited_once()
    inserted_doc = db.segments.insert_one.await_args.args[0]
    assert inserted_doc["strava_id"] == "123"
    assert inserted_doc["name"] == "Segment Name"
    assert inserted_doc["approved"] is False


@pytest.mark.integration
def test_create_segment_rejects_duplicate(monkeypatch, app_client):
    import routers.segments as segments_router

    db = SimpleNamespace(segments=SimpleNamespace(find_one=AsyncMock(return_value={"_id": ObjectId()})))
    monkeypatch.setattr(segments_router, "get_db", lambda: db)
    monkeypatch.setattr(segments_router, "fetch_segment_details", AsyncMock(return_value=None))

    response = app_client.post(
        "/api/segments",
        json={"strava_url": "https://www.strava.com/segments/123"},
        headers=user_auth_headers(),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Segment already exists"


@pytest.mark.integration
def test_report_segment_blocked_handles_already_reported_and_threshold(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(
            find_one=AsyncMock(return_value={"_id": segment_id, "blocked": False}),
            update_one=AsyncMock(),
        ),
        segment_block_reports=SimpleNamespace(
            find_one=AsyncMock(side_effect=[{"segment_id": segment_id}, None, None]),
            insert_one=AsyncMock(side_effect=[None, DuplicateKeyError("dup")]),
            count_documents=AsyncMock(side_effect=[1, 2, 2]),
        ),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    first = app_client.post(
        f"/api/segments/{segment_id}/report-blocked",
        json={},
        headers=user_auth_headers(),
    )
    assert first.status_code == 200
    assert first.json()["status"] == "already_reported"

    second = app_client.post(
        f"/api/segments/{segment_id}/report-blocked",
        json={"blocked_until": "2026-03-07T10:00:00+00:00"},
        headers=user_auth_headers(22222),
    )
    assert second.status_code == 200
    assert second.json()["status"] == "reported"
    assert second.json()["blocked"] is True
    db.segments.update_one.assert_awaited_once()

    third = app_client.post(
        f"/api/segments/{segment_id}/report-blocked",
        json={},
        headers=user_auth_headers(33333),
    )
    assert third.status_code == 200
    assert third.json()["status"] == "already_reported"


@pytest.mark.integration
def test_delete_segment_success_and_not_found(monkeypatch, app_client):
    import routers.segments as segments_router

    segment_id = ObjectId()
    db = SimpleNamespace(
        segments=SimpleNamespace(delete_one=AsyncMock(side_effect=[SimpleNamespace(deleted_count=1), SimpleNamespace(deleted_count=0)])),
        segment_block_reports=SimpleNamespace(delete_many=AsyncMock()),
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: db)

    ok = app_client.delete(f"/api/segments/{segment_id}", headers=admin_auth_headers())
    assert ok.status_code == 200
    assert ok.json() == {"status": "deleted"}
    db.segment_block_reports.delete_many.assert_awaited_once_with({"segment_id": segment_id})

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
                            "blocked_until": "2026-03-07T10:00:00+00:00",
                        }
                    ]
                )
            )
        ),
    )
    monkeypatch.setattr(admin_router, "get_db", lambda: db)

    approve = app_client.post(f"/api/admin/segments/{segment_id}/approve", headers=admin_auth_headers())
    assert approve.status_code == 200
    assert approve.json() == {"status": "approved"}

    block = app_client.patch(
        f"/api/admin/segments/{segment_id}/block",
        json={"blocked_until": "2026-03-07T10:00:00+00:00"},
        headers=admin_auth_headers(),
    )
    assert block.status_code == 200
    assert block.json() == {"status": "blocked"}

    unblock = app_client.patch(f"/api/admin/segments/{segment_id}/unblock", headers=admin_auth_headers())
    assert unblock.status_code == 200
    assert unblock.json() == {"status": "unblocked"}

    reports = app_client.get(f"/api/admin/segments/{segment_id}/blocked-reports", headers=admin_auth_headers())
    assert reports.status_code == 200
    assert reports.json()["reports_count"] == 1
    assert reports.json()["reports"][0]["reported_by_actor_id"] == "actor-1"


@pytest.mark.integration
def test_list_segments_and_admin_lists_include_report_counts(monkeypatch, app_client):
    import routers.admin as admin_router
    import routers.segments as segments_router

    pub_id = ObjectId()
    admin_id = ObjectId()
    user_db = SimpleNamespace(
        segments=SimpleNamespace(
            find=Mock(
                return_value=FindCursor([{"_id": pub_id, "approved": True, "strava_url": "https://www.strava.com/segments/1"}])
            )
        )
    )
    admin_db = SimpleNamespace(
        segments=SimpleNamespace(
            find=Mock(
                side_effect=[
                    FindCursor([{"_id": admin_id, "approved": False, "created_at": "2026-03-05T10:00:00+00:00"}]),
                    FindCursor([{"_id": admin_id, "approved": False, "created_at": "2026-03-05T10:00:00+00:00"}]),
                ]
            )
        )
    )
    monkeypatch.setattr(segments_router, "get_db", lambda: user_db)
    monkeypatch.setattr(admin_router, "get_db", lambda: admin_db)
    monkeypatch.setattr(segments_router, "get_block_report_counts", AsyncMock(return_value={str(pub_id): 2}))
    monkeypatch.setattr(admin_router, "get_block_report_counts", AsyncMock(return_value={str(admin_id): 1}))
    monkeypatch.setattr(segments_router, "auto_unblock_if_needed", AsyncMock())
    monkeypatch.setattr(admin_router, "enrich_admin_segment_users", AsyncMock())

    segments_res = app_client.get("/api/segments")
    assert segments_res.status_code == 200
    assert segments_res.json()[0]["blocked_report_count"] == 2

    unapproved = app_client.get("/api/admin/segments/unapproved", headers=admin_auth_headers())
    assert unapproved.status_code == 200
    assert unapproved.json()[0]["blocked_report_count"] == 1

    all_segments = app_client.get("/api/admin/segments", headers=admin_auth_headers())
    assert all_segments.status_code == 200
    assert all_segments.json()[0]["blocked_report_count"] == 1
