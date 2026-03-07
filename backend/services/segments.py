import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from schemas import RATING_FIELD_BOUNDS, RATING_FIELDS


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
        "average_ratings": {field: None for field in RATING_FIELDS},
    }


def valid_rating_query(prefix: str = "ratings") -> dict:
    return {
        f"{prefix}.{field}": {"$gte": bounds[0], "$lte": bounds[1]} for field, bounds in RATING_FIELD_BOUNDS.items()
    }


def _normalize_average_ratings(raw_average: dict | None) -> dict[str, float | None]:
    normalized: dict[str, float | None] = {}
    for field in RATING_FIELDS:
        raw_value = raw_average.get(field) if isinstance(raw_average, dict) else None
        if isinstance(raw_value, (int, float)):
            normalized[field] = float(raw_value)
        else:
            normalized[field] = None
    return normalized


def ensure_segment_rating_stats(segment: dict) -> None:
    defaults = empty_segment_rating_stats()
    count = segment.get("ratings_count")
    if not isinstance(count, int) or count < 0:
        count = defaults["ratings_count"]

    average_ratings = _normalize_average_ratings(segment.get("average_ratings"))

    if count == 0:
        average_ratings = defaults["average_ratings"]

    segment["ratings_count"] = count
    segment["average_ratings"] = average_ratings
    segment.pop("rating_totals", None)


def _stats_from_aggregated_payload(payload: dict | None) -> dict:
    if not payload:
        return empty_segment_rating_stats()

    ratings_count = int(payload.get("ratings_count", 0) or 0)
    if ratings_count <= 0:
        return empty_segment_rating_stats()

    average_ratings = {}
    for field in RATING_FIELDS:
        total = int(payload.get(f"{field}_total", 0) or 0)
        average_ratings[field] = round(total / ratings_count, 2)
    return {"ratings_count": ratings_count, "average_ratings": average_ratings}


async def get_segment_rating_stats(db, segment_id: ObjectId) -> dict:
    aggregate_fields = {f"{field}_total": {"$sum": f"$ratings.{field}"} for field in RATING_FIELDS}
    match_query = {"segment_id": segment_id, **valid_rating_query()}
    aggregated = (
        await db.segment_ratings.aggregate(
            [
                {"$match": match_query},
                {"$group": {"_id": None, "ratings_count": {"$sum": 1}, **aggregate_fields}},
            ]
        ).to_list(length=1)
    )
    return _stats_from_aggregated_payload(aggregated[0] if aggregated else None)


async def enrich_segments_with_rating_stats(db, segments: list[dict]) -> None:
    if not segments:
        return

    segment_ids = [segment["_id"] for segment in segments]
    aggregate_fields = {f"{field}_total": {"$sum": f"$ratings.{field}"} for field in RATING_FIELDS}
    match_query = {"segment_id": {"$in": segment_ids}, **valid_rating_query()}
    aggregates = (
        await db.segment_ratings.aggregate(
            [
                {"$match": match_query},
                {"$group": {"_id": "$segment_id", "ratings_count": {"$sum": 1}, **aggregate_fields}},
            ]
        ).to_list(length=None)
    )
    stats_by_segment_id = {
        aggregate["_id"]: _stats_from_aggregated_payload(aggregate) for aggregate in aggregates if aggregate.get("_id") is not None
    }
    defaults = empty_segment_rating_stats()
    for segment in segments:
        stats = stats_by_segment_id.get(segment["_id"], defaults)
        segment["ratings_count"] = stats["ratings_count"]
        segment["average_ratings"] = stats["average_ratings"]
        segment.pop("rating_totals", None)


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
