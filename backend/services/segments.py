import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException


def extract_strava_id(strava_url: str) -> str | None:
    if not strava_url:
        return None
    match = re.search(r"segments/(\d+)", strava_url)
    return match.group(1) if match else None


def parse_object_id(segment_id: str) -> ObjectId:
    try:
        return ObjectId(segment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")


def to_user_summary(user_doc: dict) -> dict:
    return {
        "strava_id": user_doc["strava_id"],
        "username": user_doc.get("username"),
        "firstname": user_doc.get("firstname"),
        "lastname": user_doc.get("lastname"),
    }


def serialize_segment(segment: dict, blocked_report_count: int | None = None) -> dict:
    if blocked_report_count is not None:
        segment["blocked_report_count"] = blocked_report_count
    segment["id"] = str(segment["_id"])
    del segment["_id"]
    return segment


async def get_block_report_counts(db, segment_object_ids: list[ObjectId]) -> dict[str, int]:
    if not segment_object_ids:
        return {}

    pipeline = [
        {"$match": {"segment_id": {"$in": segment_object_ids}}},
        {"$group": {"_id": "$segment_id", "count": {"$sum": 1}}},
    ]
    grouped = await db.segment_block_reports.aggregate(pipeline).to_list(length=None)
    return {str(item["_id"]): item["count"] for item in grouped}


async def enrich_admin_segment_users(db, segments: list[dict]) -> None:
    if not segments:
        return

    segment_ids = [segment["_id"] for segment in segments]
    reports = (
        await db.segment_block_reports.find(
            {"segment_id": {"$in": segment_ids}},
            {"_id": 0, "segment_id": 1, "reported_by_strava_id": 1, "reported_at": 1},
        )
        .sort("reported_at", -1)
        .to_list(length=None)
    )

    reporter_ids_by_segment: dict[str, list[int]] = {}
    reporter_id_seen_by_segment: dict[str, set[int]] = {}
    all_user_ids: set[int] = set()

    for segment in segments:
        user_id = segment.get("submitted_by_strava_id")
        if isinstance(user_id, int):
            all_user_ids.add(user_id)

    for report in reports:
        reporter_id = report.get("reported_by_strava_id")
        if not isinstance(reporter_id, int):
            continue
        segment_key = str(report["segment_id"])
        if segment_key not in reporter_ids_by_segment:
            reporter_ids_by_segment[segment_key] = []
            reporter_id_seen_by_segment[segment_key] = set()
        if reporter_id not in reporter_id_seen_by_segment[segment_key]:
            reporter_ids_by_segment[segment_key].append(reporter_id)
            reporter_id_seen_by_segment[segment_key].add(reporter_id)
        all_user_ids.add(reporter_id)

    users = (
        await db.users.find(
            {"strava_id": {"$in": list(all_user_ids)}},
            {"_id": 0, "strava_id": 1, "username": 1, "firstname": 1, "lastname": 1},
        ).to_list(length=None)
        if all_user_ids
        else []
    )

    user_map: dict[int, dict] = {user["strava_id"]: to_user_summary(user) for user in users}

    for segment in segments:
        segment_key = str(segment["_id"])
        segment_reporter_ids = reporter_ids_by_segment.get(segment_key, [])
        segment["reported_by_strava_ids"] = segment_reporter_ids

        submitted_by_id = segment.get("submitted_by_strava_id")

        if isinstance(submitted_by_id, int):
            segment["submitted_by_user"] = user_map.get(submitted_by_id, {"strava_id": submitted_by_id})

        segment["reported_by_users"] = [
            user_map.get(reporter_id, {"strava_id": reporter_id}) for reporter_id in segment_reporter_ids
        ]


async def auto_unblock_if_needed(db, segment: dict, now: datetime):
    if segment.get("blocked") and segment.get("blocked_until"):
        try:
            until = datetime.fromisoformat(segment["blocked_until"])
            if until <= now:
                await db.segments.update_one(
                    {"_id": segment["_id"]},
                    {"$set": {"blocked": False, "blocked_until": None}},
                )
                segment["blocked"] = False
                segment["blocked_until"] = None
        except (ValueError, TypeError):
            pass


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
