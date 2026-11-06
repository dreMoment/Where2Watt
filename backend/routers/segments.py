from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError

from database import get_db
from dependencies import ActorIdentity, verify_active_user, verify_admin
from rate_limiter import limiter
from schemas import (
    SegmentCategoryRatingSchema,
    SegmentCreateSchema,
    SegmentPublicResponseSchema,
    SegmentRatingResponseSchema,
    SegmentReportSchema,
    SegmentSubmitResponseSchema,
)
from services.segments import (
    canonical_strava_segment_url,
    get_segment_rating_stats,
    enrich_segments_with_rating_stats,
    now_iso,
    parse_object_id,
    segment_identity_query,
    serialize_segment,
)
from services.notifications import notify_new_segment_submission
from services.strava import fetch_segment_details, resolve_segment_id_from_strava_url

router = APIRouter()


async def _upsert_actor_rating_for_segment(
    db,
    segment_obj_id,
    actor_id: str,
    submitted_ratings: dict,
) -> str:
    rating_identity = {"segment_id": segment_obj_id, "rated_by_actor_id": actor_id}
    rating_update = {
        "$set": {"ratings": submitted_ratings, "rated_at": now_iso()},
        "$setOnInsert": rating_identity,
    }
    try:
        result = await db.segment_ratings.update_one(
            rating_identity,
            rating_update,
            upsert=True,
        )
    except DuplicateKeyError:
        # Another concurrent request inserted the unique actor/segment pair first.
        await db.segment_ratings.update_one(
            rating_identity,
            {"$set": rating_update["$set"]},
        )
        return "updated"

    return "added" if result.upserted_id is not None else "updated"


def _existing_submission_reason(existing_segment: dict, segment_id: str) -> str:
    if not bool(existing_segment.get("approved", False)):
        return "under_review"
    if str(existing_segment.get("strava_id", "")).strip() == segment_id:
        return "already_in_database"
    return "similar_segment"


@router.post("/api/segments", response_model=SegmentSubmitResponseSchema)
@limiter.limit("10/minute")
async def create_segment(
    request: Request,
    response: Response,
    segment: SegmentCreateSchema,
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    submitted_ratings = segment.ratings.model_dump()
    strava_url = segment.strava_url

    segment_id = await resolve_segment_id_from_strava_url(strava_url, db=db, actor_id=identity.actor_id)
    if not segment_id:
        raise HTTPException(
            status_code=400,
            detail="Something went wrong. Please check if the Strava URL is correct.",
        )

    existing = await db.segments.find_one(segment_identity_query(segment_id))
    if existing:
        rating_status = await _upsert_actor_rating_for_segment(db, existing["_id"], identity.actor_id, submitted_ratings)
        existing.update(await get_segment_rating_stats(db, existing["_id"]))
        serialized = serialize_segment(existing)
        return {
            **serialized,
            "status": "existing",
            "duplicate_reason": _existing_submission_reason(existing, segment_id),
            "rating_status": rating_status,
        }
    details = await fetch_segment_details(segment_id, db=db, actor_id=identity.actor_id)
    if not details:
        raise HTTPException(
            status_code=400,
            detail="Something went wrong. Please check if the Strava URL is correct.",
        )
    safety_notes = (segment.safety_notes or "").strip() or None
    segment_dict = {
        "strava_url": canonical_strava_segment_url(segment_id),
        "strava_id": segment_id,
        "safety_notes": safety_notes,
        "polyline": details.get("polyline"),
        "name": details.get("name"),
        "distance_km": details.get("distance_km"),
        "gradient_pct": details.get("gradient_pct"),
        "elevation_profile": details.get("elevation_profile"),
        "created_at": now_iso(),
        "approved": False,
        "aliases": [],
    }

    response.status_code = 201
    result = await db.segments.insert_one(segment_dict)
    rating_status = await _upsert_actor_rating_for_segment(db, result.inserted_id, identity.actor_id, submitted_ratings)
    created_segment = {"_id": result.inserted_id, **segment_dict}
    created_segment.update(await get_segment_rating_stats(db, result.inserted_id))
    await notify_new_segment_submission(
        strava_url=created_segment.get("strava_url"),
        strava_id=created_segment.get("strava_id"),
        segment_name=created_segment.get("name"),
        submitted_by_actor_id=identity.actor_id,
        created_at=created_segment.get("created_at"),
    )
    serialized = serialize_segment(created_segment)
    return {
        **serialized,
        "status": "created",
        "duplicate_reason": None,
        "rating_status": rating_status,
    }


@router.get("/api/segments", response_model=list[SegmentPublicResponseSchema])
@limiter.limit("120/minute")
async def list_segments(request: Request):
    db = get_db()
    segments = await db.segments.find({"$or": [{"approved": True}, {"approved": {"$exists": False}}]}).to_list(100)
    await enrich_segments_with_rating_stats(db, segments)
    for segment in segments:
        serialize_segment(segment)
    return segments


@router.post("/api/segments/{segment_id}/ratings", response_model=SegmentRatingResponseSchema)
@limiter.limit("20/minute")
async def rate_segment(
    request: Request,
    segment_id: str,
    rating: SegmentCategoryRatingSchema,
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    obj_id = parse_object_id(segment_id)
    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    await _upsert_actor_rating_for_segment(db, obj_id, identity.actor_id, rating.model_dump())

    stats = await get_segment_rating_stats(db, obj_id)
    return {
        "status": "rated",
        "ratings_count": stats["ratings_count"],
        "average_ratings": stats["average_ratings"],
    }


@router.delete("/api/segments/{segment_id}/ratings", response_model=SegmentRatingResponseSchema)
@limiter.limit("20/minute")
async def delete_my_segment_rating(
    request: Request,
    segment_id: str,
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    obj_id = parse_object_id(segment_id)
    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    delete_result = await db.segment_ratings.delete_one({"segment_id": obj_id, "rated_by_actor_id": identity.actor_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rating not found")

    stats = await get_segment_rating_stats(db, obj_id)
    return {
        "status": "deleted",
        "ratings_count": stats["ratings_count"],
        "average_ratings": stats["average_ratings"],
    }


@router.get("/api/segments/{segment_id}/my-rating-status")
@limiter.limit("30/minute")
async def get_my_rating_status(request: Request, segment_id: str, identity: ActorIdentity = Depends(verify_active_user)):
    db = get_db()
    obj_id = parse_object_id(segment_id)
    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    existing_rating = await db.segment_ratings.find_one(
        {"segment_id": obj_id, "rated_by_actor_id": identity.actor_id},
        {"_id": 0, "ratings": 1, "rated_at": 1},
    )
    return {
        "segment_id": segment_id,
        "has_rated": bool(existing_rating),
        "rating": existing_rating.get("ratings") if existing_rating else None,
        "rated_at": existing_rating.get("rated_at") if existing_rating else None,
    }


@router.post("/api/segments/{segment_id}/report-blocked")
@limiter.limit("5/minute")
async def report_segment_blocked(
    request: Request,
    segment_id: str,
    data: SegmentReportSchema = SegmentReportSchema(),
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    if segment.get("blocked"):
        raise HTTPException(status_code=409, detail="Segment is already blocked; report it as unblocked instead")

    report_doc = {
        "segment_id": obj_id,
        "reported_by_actor_id": identity.actor_id,
        "action": "blocked",
        "reported_at": now_iso(),
        "note": data.note,
    }

    existing_report = await db.segment_block_reports.find_one(
        {"segment_id": obj_id, "reported_by_actor_id": identity.actor_id, "action": "blocked"}
    )
    if existing_report:
        return {
            "status": "already_reported",
            "action": "blocked",
            "blocked": bool(segment.get("blocked", False)),
        }

    try:
        await db.segment_block_reports.insert_one(report_doc)
    except DuplicateKeyError:
        return {
            "status": "already_reported",
            "action": "blocked",
            "blocked": bool(segment.get("blocked", False)),
        }

    return {
        "status": "reported",
        "action": "blocked",
        "blocked": bool(segment.get("blocked", False)),
    }


@router.post("/api/segments/{segment_id}/report-unblocked")
@limiter.limit("5/minute")
async def report_segment_unblocked(
    request: Request,
    segment_id: str,
    data: SegmentReportSchema = SegmentReportSchema(),
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    if not segment.get("blocked"):
        raise HTTPException(status_code=409, detail="Segment is already free; report it as blocked instead")

    report_doc = {
        "segment_id": obj_id,
        "reported_by_actor_id": identity.actor_id,
        "action": "unblocked",
        "reported_at": now_iso(),
        "note": data.note,
    }

    existing_report = await db.segment_block_reports.find_one(
        {"segment_id": obj_id, "reported_by_actor_id": identity.actor_id, "action": "unblocked"}
    )
    if existing_report:
        return {
            "status": "already_reported",
            "action": "unblocked",
            "blocked": bool(segment.get("blocked", False)),
        }

    try:
        await db.segment_block_reports.insert_one(report_doc)
    except DuplicateKeyError:
        return {
            "status": "already_reported",
            "action": "unblocked",
            "blocked": bool(segment.get("blocked", False)),
        }

    return {
        "status": "reported",
        "action": "unblocked",
        "blocked": bool(segment.get("blocked", False)),
    }


@router.get("/api/segments/{segment_id}/my-report-status")
@limiter.limit("30/minute")
async def get_my_report_status(request: Request, segment_id: str, identity: ActorIdentity = Depends(verify_active_user)):
    db = get_db()
    obj_id = parse_object_id(segment_id)
    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    expected_action = "unblocked" if segment.get("blocked") else "blocked"
    existing_report = await db.segment_block_reports.find_one(
        {"segment_id": obj_id, "reported_by_actor_id": identity.actor_id, "action": expected_action},
        {"_id": 0, "action": 1, "reported_at": 1, "note": 1},
    )
    return {
        "segment_id": segment_id,
        "expected_action": expected_action,
        "has_reported": bool(existing_report),
        "report": existing_report,
    }


@router.delete("/api/segments/{segment_id}", dependencies=[Depends(verify_admin)])
@limiter.limit("30/minute")
async def delete_segment(request: Request, segment_id: str):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})
    await db.segment_ratings.delete_many({"segment_id": obj_id})

    return {"status": "deleted"}
