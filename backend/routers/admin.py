from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from database import get_db
from dependencies import ActorIdentity, verify_active_user, verify_admin
from rate_limiter import limiter
from schemas import (
    AdminBlockSegmentSchema,
    AdminDeleteSegmentRatingResponseSchema,
    AdminMergeSegmentResponseSchema,
    AdminMergeSegmentSchema,
    AdminSplitSegmentResponseSchema,
    QuickAddSchema,
    RATING_FIELD_BOUNDS,
    SegmentAdminRatingSchema,
    SegmentResponseSchema,
)
from services.segments import (
    empty_segment_rating_stats,
    enrich_segments_with_rating_stats,
    enrich_admin_segment_users,
    get_segment_rating_stats,
    normalize_aliases,
    now_iso,
    parse_object_id,
    serialize_segment,
    valid_rating_query,
)
from services.strava import fetch_segment_details, resolve_segment_id_from_strava_url

router = APIRouter()


async def recompute_segment_rating_stats(db, segment_id: ObjectId) -> dict:
    return await get_segment_rating_stats(db, segment_id)


def _segment_aliases(segment: dict) -> list[str]:
    strava_id = segment.get("strava_id")
    excluded = {strava_id.strip()} if isinstance(strava_id, str) and strava_id.strip() else set()
    return normalize_aliases(segment.get("aliases"), exclude=excluded)


def _merged_aliases(source_segment: dict, target_segment: dict) -> list[str]:
    target_strava_id = target_segment.get("strava_id")
    target_excluded = {target_strava_id.strip()} if isinstance(target_strava_id, str) and target_strava_id.strip() else set()

    merged = _segment_aliases(target_segment)
    seen = set(merged)

    source_candidates: list[str] = []
    source_strava_id = source_segment.get("strava_id")
    if isinstance(source_strava_id, str) and source_strava_id.strip():
        source_candidates.append(source_strava_id.strip())
    source_candidates.extend(_segment_aliases(source_segment))

    for alias in source_candidates:
        if alias in target_excluded or alias in seen:
            continue
        seen.add(alias)
        merged.append(alias)
    return merged


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


@router.post(
    "/api/admin/segments/{segment_id}/merge",
    response_model=AdminMergeSegmentResponseSchema,
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("30/minute")
async def merge_segment(request: Request, segment_id: str, data: AdminMergeSegmentSchema):
    db = get_db()
    source_obj_id = parse_object_id(segment_id)
    target_obj_id = parse_object_id(data.target_segment_id)

    if source_obj_id == target_obj_id:
        raise HTTPException(status_code=400, detail="Source and target segments must be different")

    source_segment = await db.segments.find_one({"_id": source_obj_id})
    if not source_segment:
        raise HTTPException(status_code=404, detail="Source segment not found")

    target_segment = await db.segments.find_one({"_id": target_obj_id})
    if not target_segment:
        raise HTTPException(status_code=404, detail="Target segment not found")

    source_ratings = await db.segment_ratings.find({"segment_id": source_obj_id}).to_list(5000)
    target_ratings = await db.segment_ratings.find({"segment_id": target_obj_id}, {"rated_by_actor_id": 1}).to_list(5000)
    target_actor_ids = {
        actor_id
        for rating in target_ratings
        for actor_id in [rating.get("rated_by_actor_id")]
        if isinstance(actor_id, str) and actor_id
    }

    moved_ratings = 0
    for rating in source_ratings:
        actor_id = rating.get("rated_by_actor_id")
        if isinstance(actor_id, str) and actor_id and actor_id in target_actor_ids:
            await db.segment_ratings.delete_one({"_id": rating["_id"], "segment_id": source_obj_id})
            continue

        move_result = await db.segment_ratings.update_one(
            {"_id": rating["_id"], "segment_id": source_obj_id},
            {"$set": {"segment_id": target_obj_id}},
        )
        moved_ratings += int(move_result.modified_count)
        if isinstance(actor_id, str) and actor_id:
            target_actor_ids.add(actor_id)

    aliases = _merged_aliases(source_segment, target_segment)
    await db.segments.update_one({"_id": target_obj_id}, {"$set": {"aliases": aliases}})

    delete_result = await db.segments.delete_one({"_id": source_obj_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source segment not found")
    await db.segment_block_reports.delete_many({"segment_id": source_obj_id})

    return {
        "status": "merged",
        "merged_from_segment_id": segment_id,
        "merged_into_segment_id": data.target_segment_id,
        "moved_ratings": moved_ratings,
        "aliases": aliases,
    }


@router.post(
    "/api/admin/segments/{segment_id}/split",
    response_model=AdminSplitSegmentResponseSchema,
    dependencies=[Depends(verify_admin)],
)
@limiter.limit("20/minute")
async def split_segment(
    request: Request,
    segment_id: str,
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    source_obj_id = parse_object_id(segment_id)

    source_segment = await db.segments.find_one({"_id": source_obj_id})
    if not source_segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    aliases = _segment_aliases(source_segment)
    if not aliases:
        raise HTTPException(status_code=400, detail="Segment has no aliases to split")

    existing_alias_docs = (
        await db.segments.find({"strava_id": {"$in": aliases}}, {"_id": 1, "strava_id": 1}).to_list(len(aliases))
    )
    existing_aliases = {
        str(alias_doc["strava_id"])
        for alias_doc in existing_alias_docs
        if alias_doc.get("_id") != source_obj_id and isinstance(alias_doc.get("strava_id"), str)
    }
    aliases_to_create = [alias for alias in aliases if alias not in existing_aliases]

    alias_details: dict[str, dict] = {}
    for alias in aliases_to_create:
        details = await fetch_segment_details(alias, db=db, actor_id=identity.actor_id)
        if not details:
            raise HTTPException(status_code=400, detail=f"Could not fetch segment details from Strava for alias {alias}")
        alias_details[alias] = details

    created_segments: list[dict] = []
    for alias in aliases_to_create:
        details = alias_details[alias]

        segment_doc = {
            "strava_url": f"https://www.strava.com/segments/{alias}",
            "strava_id": alias,
            "name": details.get("name"),
            "polyline": details.get("polyline"),
            "distance_km": details.get("distance_km"),
            "gradient_pct": details.get("gradient_pct"),
            "approved": bool(source_segment.get("approved", False)),
            "blocked": bool(source_segment.get("blocked", False)),
            "block_message": source_segment.get("block_message"),
            "aliases": [],
            "created_at": now_iso(),
        }

        insert_result = await db.segments.insert_one(segment_doc)
        created_segment = await db.segments.find_one({"_id": insert_result.inserted_id})
        created_segment.update(empty_segment_rating_stats())
        created_segments.append(serialize_segment(created_segment))

    await db.segments.update_one({"_id": source_obj_id}, {"$set": {"aliases": []}})

    return {
        "status": "split",
        "source_segment_id": segment_id,
        "created_segments": created_segments,
        "skipped_aliases": [alias for alias in aliases if alias in existing_aliases],
    }


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
async def quick_add_segment(
    request: Request,
    data: QuickAddSchema,
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    strava_url = data.strava_url

    segment_id = await resolve_segment_id_from_strava_url(strava_url, db=db, actor_id=identity.actor_id)
    if not segment_id:
        raise HTTPException(status_code=400, detail="Invalid Strava URL")

    existing = await db.segments.find_one(
        {
            "$or": [
                {"strava_id": segment_id},
                {"aliases": segment_id},
                {"strava_url": {"$regex": f"segments/{segment_id}(?![0-9])"}},
            ]
        }
    )
    if existing:
        raise HTTPException(status_code=400, detail="Segment already exists")

    details = await fetch_segment_details(segment_id, db=db, actor_id=identity.actor_id)
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
        "aliases": [],
        "created_at": now_iso(),
    }

    result = await db.segments.insert_one(segment_dict)
    created_segment = await db.segments.find_one({"_id": result.inserted_id})
    created_segment.update(empty_segment_rating_stats())
    return serialize_segment(created_segment)
