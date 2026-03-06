import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

RATING_FIELDS = ("traffic", "steady_gradient", "sketchy_left_turns", "downhills")


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
    return {"actor_id": user_doc["actor_id"]}


def empty_segment_rating_stats() -> dict:
    return {
        "ratings_count": 0,
        "rating_totals": {field: 0 for field in RATING_FIELDS},
        "average_ratings": {field: None for field in RATING_FIELDS},
    }


def initial_segment_rating_stats(ratings: dict[str, int]) -> dict:
    rating_totals = {field: int(ratings.get(field, 0)) for field in RATING_FIELDS}
    return {
        "ratings_count": 1,
        "rating_totals": rating_totals,
        "average_ratings": {field: float(rating_totals[field]) for field in RATING_FIELDS},
    }


def ensure_segment_rating_stats(segment: dict) -> None:
    defaults = empty_segment_rating_stats()
    count = segment.get("ratings_count")
    if not isinstance(count, int) or count < 0:
        count = defaults["ratings_count"]

    raw_totals = segment.get("rating_totals")
    rating_totals: dict[str, int] = {}
    for field in RATING_FIELDS:
        if isinstance(raw_totals, dict):
            raw_value = raw_totals.get(field, 0)
        else:
            raw_value = 0
        if isinstance(raw_value, (int, float)):
            rating_totals[field] = int(raw_value)
        else:
            rating_totals[field] = 0

    if count > 0:
        average_ratings = {field: round(rating_totals[field] / count, 2) for field in RATING_FIELDS}
    else:
        average_ratings = defaults["average_ratings"]

    segment["ratings_count"] = count
    segment["rating_totals"] = rating_totals
    segment["average_ratings"] = average_ratings


def serialize_segment(segment: dict) -> dict:
    ensure_segment_rating_stats(segment)
    segment["id"] = str(segment["_id"])
    del segment["_id"]
    return segment


async def enrich_admin_segment_users(db, segments: list[dict]) -> None:
    if not segments:
        return

    segment_ids = [segment["_id"] for segment in segments]
    reports = (
        await db.segment_block_reports.find(
            {"segment_id": {"$in": segment_ids}},
            {"_id": 0, "segment_id": 1, "reported_by_actor_id": 1, "reported_at": 1, "action": 1, "note": 1},
        )
        .sort("reported_at", -1)
        .to_list(length=None)
    )

    reporter_ids_by_segment: dict[str, list[str]] = {}
    reporter_id_seen_by_segment: dict[str, set[str]] = {}
    report_queue_by_segment: dict[str, list[dict]] = {}

    for report in reports:
        reporter_id = report.get("reported_by_actor_id")
        if not isinstance(reporter_id, str) or not reporter_id:
            continue
        segment_key = str(report["segment_id"])
        if segment_key not in report_queue_by_segment:
            report_queue_by_segment[segment_key] = []
        report_queue_by_segment[segment_key].append(
            {
                "reported_by_actor_id": reporter_id,
                "reported_at": report.get("reported_at"),
                "action": report.get("action"),
                "note": report.get("note"),
            }
        )
        if segment_key not in reporter_ids_by_segment:
            reporter_ids_by_segment[segment_key] = []
            reporter_id_seen_by_segment[segment_key] = set()
        if reporter_id not in reporter_id_seen_by_segment[segment_key]:
            reporter_ids_by_segment[segment_key].append(reporter_id)
            reporter_id_seen_by_segment[segment_key].add(reporter_id)
    user_map: dict[str, dict] = {}

    for segment in segments:
        segment_key = str(segment["_id"])
        segment_reporter_ids = reporter_ids_by_segment.get(segment_key, [])
        segment["reported_by_actor_ids"] = segment_reporter_ids
        segment["block_reports"] = report_queue_by_segment.get(segment_key, [])

        submitted_by_id = segment.get("submitted_by_actor_id")

        if isinstance(submitted_by_id, str) and submitted_by_id:
            segment["submitted_by_user"] = user_map.get(submitted_by_id, {"actor_id": submitted_by_id})

        segment["reported_by_users"] = [
            user_map.get(reporter_id, {"actor_id": reporter_id}) for reporter_id in segment_reporter_ids
        ]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
