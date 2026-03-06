from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from database import get_db
from dependencies import verify_admin
from rate_limiter import limiter
from schemas import (
    AdminDeleteSegmentRatingResponseSchema,
    QuickAddSchema,
    SEGMENT_RATING_MAX,
    SEGMENT_RATING_MIN,
    SegmentAdminRatingSchema,
    SegmentResponseSchema,
)
from services.segments import (
    RATING_FIELDS,
    empty_segment_rating_stats,
    enrich_segments_with_rating_stats,
    enrich_admin_segment_users,
    extract_strava_id,
    get_segment_rating_stats,
    now_iso,
    parse_object_id,
    serialize_segment,
)
from services.strava import fetch_segment_details

router = APIRouter()


async def recompute_segment_rating_stats(db, segment_id: ObjectId) -> dict:
    return await get_segment_rating_stats(db, segment_id)


@router.post("/api/admin/verify")
@limiter.limit("5/minute")
async def verify_admin_password(request: Request, is_admin: bool = Depends(verify_admin)):
    return {"status": "ok"}


@router.get("/api/admin/segments/unapproved", response_model=List[SegmentResponseSchema])
@limiter.limit("60/minute")
async def list_unapproved_segments(request: Request, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    segments = await db.segments.find({"approved": False}).sort("created_at", -1).to_list(100)
    await enrich_admin_segment_users(db, segments)
    await enrich_segments_with_rating_stats(db, segments)
    for segment in segments:
        serialize_segment(segment)
    return segments


@router.get("/api/admin/segments", response_model=List[SegmentResponseSchema])
@limiter.limit("60/minute")
async def list_all_segments(request: Request, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    segments = await db.segments.find().sort("created_at", -1).to_list(500)
    await enrich_admin_segment_users(db, segments)
    await enrich_segments_with_rating_stats(db, segments)
    for segment in segments:
        serialize_segment(segment)
    return segments


@router.get("/api/admin/segments/{segment_id}/ratings", response_model=List[SegmentAdminRatingSchema])
@limiter.limit("120/minute")
async def list_segment_ratings(request: Request, segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id}, {"_id": 1})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    ratings = await db.segment_ratings.find({"segment_id": obj_id}).sort("rated_at", -1).to_list(500)
    response: list[dict] = []
    for rating in ratings:
        raw_ratings = rating.get("ratings")
        if not isinstance(raw_ratings, dict):
            raw_ratings = {}
        normalized_ratings: dict[str, int] = {}
        for field in RATING_FIELDS:
            raw_value = raw_ratings.get(field)
            if isinstance(raw_value, (int, float)):
                parsed = int(raw_value)
            else:
                parsed = SEGMENT_RATING_MIN
            normalized_ratings[field] = max(SEGMENT_RATING_MIN, min(SEGMENT_RATING_MAX, parsed))
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
)
@limiter.limit("60/minute")
async def delete_segment_rating(request: Request, segment_id: str, rating_id: str, is_admin: bool = Depends(verify_admin)):
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


@router.get("/api/admin/segments/{segment_id}/blocked-reports")
@limiter.limit("120/minute")
async def list_block_reports_for_segment(request: Request, segment_id: str, is_admin: bool = Depends(verify_admin)):
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


@router.post("/api/admin/segments/{segment_id}/approve")
@limiter.limit("30/minute")
async def approve_segment(request: Request, segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"approved": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "approved"}


@router.patch("/api/admin/segments/{segment_id}/block")
@limiter.limit("30/minute")
async def block_segment(request: Request, segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"blocked": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})

    return {"status": "blocked"}


@router.patch("/api/admin/segments/{segment_id}/unblock")
@limiter.limit("30/minute")
async def unblock_segment(request: Request, segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"blocked": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})

    return {"status": "unblocked"}


@router.post("/api/admin/segments/quickadd", response_model=SegmentResponseSchema, status_code=201)
@limiter.limit("20/minute")
async def quick_add_segment(request: Request, data: QuickAddSchema, is_admin: bool = Depends(verify_admin)):
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
