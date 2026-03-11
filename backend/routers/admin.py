from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from database import get_db
from dependencies import verify_admin
from rate_limiter import limiter
from schemas import (
    AdminBlockSegmentSchema,
    AdminDeleteSegmentRatingResponseSchema,
    QuickAddSchema,
    RATING_FIELD_BOUNDS,
    SegmentAdminRatingSchema,
    SegmentResponseSchema,
)
from services.segments import (
    empty_segment_rating_stats,
    enrich_segments_with_rating_stats,
    enrich_admin_segment_users,
    extract_strava_id,
    get_segment_rating_stats,
    now_iso,
    parse_object_id,
    serialize_segment,
    valid_rating_query,
)
from services.strava import fetch_segment_details

router = APIRouter()


async def recompute_segment_rating_stats(db, segment_id: ObjectId) -> dict:
    return await get_segment_rating_stats(db, segment_id)


@router.post("/api/admin/verify", dependencies=[Depends(verify_admin)])
@limiter.limit("5/minute")
async def verify_admin_password(request: Request):
    return {"status": "ok"}


@router.get(
    "/api/admin/segments/unapproved",
    response_model=List[SegmentResponseSchema],
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("60/minute")
async def list_unapproved_segments(request: Request):
    db = get_db()
    segments = await db.segments.find({"approved": False}).sort("created_at", -1).to_list(100)
    await enrich_admin_segment_users(db, segments)
    await enrich_segments_with_rating_stats(db, segments)
    for segment in segments:
        serialize_segment(segment)
    return segments


@router.get(
    "/api/admin/segments",
    response_model=List[SegmentResponseSchema],
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("60/minute")
async def list_all_segments(request: Request):
    db = get_db()
    segments = await db.segments.find().sort("created_at", -1).to_list(500)
    await enrich_admin_segment_users(db, segments)
    await enrich_segments_with_rating_stats(db, segments)
    for segment in segments:
        serialize_segment(segment)
    return segments


@router.get(
    "/api/admin/segments/{segment_id}/ratings",
    response_model=List[SegmentAdminRatingSchema],
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("120/minute")
async def list_segment_ratings(request: Request, segment_id: str):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id}, {"_id": 1})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    ratings = await db.segment_ratings.find({"segment_id": obj_id, **valid_rating_query()}).sort("rated_at", -1).to_list(500)
    response: list[dict] = []
    for rating in ratings:
        raw_ratings = rating.get("ratings")
        if not isinstance(raw_ratings, dict):
            raw_ratings = {}
        normalized_ratings: dict[str, int] = {}
        for field, bounds in RATING_FIELD_BOUNDS.items():
            raw_value = raw_ratings.get(field)
            if isinstance(raw_value, (int, float)):
                parsed = int(raw_value)
            else:
                parsed = bounds[0]
            normalized_ratings[field] = max(bounds[0], min(bounds[1], parsed))
        response.append(
            {
                "id": str(rating["_id"]),
                "segment_id": segment_id,
                "rated_by_actor_id": rating.get("rated_by_actor_id", ""),
                "rated_at": rating.get("rated_at"),
                "ratings": normalized_ratings,
            }
        )
    return response


@router.delete(
    "/api/admin/segments/{segment_id}/ratings/{rating_id}",
    response_model=AdminDeleteSegmentRatingResponseSchema,
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("60/minute")
async def delete_segment_rating(request: Request, segment_id: str, rating_id: str):
    db = get_db()
    segment_obj_id = parse_object_id(segment_id)
    try:
        rating_obj_id = ObjectId(rating_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rating ID format")

    segment = await db.segments.find_one({"_id": segment_obj_id}, {"_id": 1})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    rating = await db.segment_ratings.find_one({"_id": rating_obj_id, "segment_id": segment_obj_id}, {"_id": 1})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    delete_result = await db.segment_ratings.delete_one({"_id": rating_obj_id, "segment_id": segment_obj_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rating not found")

    stats = await recompute_segment_rating_stats(db, segment_obj_id)
    return {
        "status": "deleted",
        "ratings_count": stats["ratings_count"],
        "average_ratings": stats["average_ratings"],
    }


@router.get("/api/admin/segments/{segment_id}/blocked-reports", dependencies=[Depends(verify_admin)])
@limiter.limit("120/minute")
async def list_block_reports_for_segment(request: Request, segment_id: str):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    reports = await db.segment_block_reports.find({"segment_id": obj_id}).sort("reported_at", -1).to_list(200)
    return {
        "segment_id": segment_id,
        "reports_count": len(reports),
        "reports": [
            {
                "reported_by_actor_id": report["reported_by_actor_id"],
                "reported_at": report["reported_at"],
                "action": report.get("action"),
                "note": report.get("note"),
            }
            for report in reports
        ],
    }


@router.post("/api/admin/segments/{segment_id}/approve", dependencies=[Depends(verify_admin)])
@limiter.limit("30/minute")
async def approve_segment(request: Request, segment_id: str):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"approved": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "approved"}


@router.patch("/api/admin/segments/{segment_id}/block", dependencies=[Depends(verify_admin)])
@limiter.limit("30/minute")
async def block_segment(
    request: Request,
    segment_id: str,
    data: AdminBlockSegmentSchema = AdminBlockSegmentSchema(),
):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    message = (data.message or "").strip()
    result = await db.segments.update_one(
        {"_id": obj_id},
        {"$set": {"blocked": True, "block_message": message if message else None}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})

    return {"status": "blocked", "block_message": message if message else None}


@router.patch("/api/admin/segments/{segment_id}/unblock", dependencies=[Depends(verify_admin)])
@limiter.limit("30/minute")
async def unblock_segment(request: Request, segment_id: str):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"blocked": False, "block_message": None}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})

    return {"status": "unblocked"}


@router.post(
    "/api/admin/segments/quickadd",
    response_model=SegmentResponseSchema,
    status_code=201,
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("20/minute")
async def quick_add_segment(request: Request, data: QuickAddSchema):
    db = get_db()
    strava_url = data.strava_url

    segment_id = extract_strava_id(strava_url)
    if not segment_id:
        raise HTTPException(status_code=400, detail="Invalid Strava URL")

    existing = await db.segments.find_one(
        {
            "$or": [
                {"strava_id": segment_id},
                {"strava_url": {"$regex": f"segments/{segment_id}(?![0-9])"}},
            ]
        }
    )
    if existing:
        raise HTTPException(status_code=400, detail="Segment already exists")

    details = await fetch_segment_details(segment_id)
    if not details:
        raise HTTPException(status_code=400, detail="Could not fetch segment details from Strava")

    segment_dict = {
        "strava_url": strava_url,
        "strava_id": segment_id,
        "name": details.get("name"),
        "polyline": details.get("polyline"),
        "distance_km": details.get("distance_km"),
        "gradient_pct": details.get("gradient_pct"),
        "approved": True,
        "created_at": now_iso(),
    }

    result = await db.segments.insert_one(segment_dict)
    created_segment = await db.segments.find_one({"_id": result.inserted_id})
    created_segment.update(empty_segment_rating_stats())
    return serialize_segment(created_segment)
