from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from config import BLOCK_REPORT_THRESHOLD
from database import get_db
from dependencies import ActorIdentity, verify_admin, verify_user
from rate_limiter import limiter
from schemas import BlockSchema, SegmentResponseSchema, SegmentSchema
from services.segments import (
    auto_unblock_if_needed,
    extract_strava_id,
    get_block_report_counts,
    now_iso,
    parse_object_id,
    serialize_segment,
)
from services.strava import fetch_segment_details

router = APIRouter()


@router.post("/api/segments", response_model=SegmentResponseSchema, status_code=201)
@limiter.limit("10/minute")
async def create_segment(request: Request, segment: SegmentSchema, identity: ActorIdentity = Depends(verify_user)):
    db = get_db()
    segment_dict = segment.model_dump()
    segment_dict["created_at"] = now_iso()
    segment_dict["approved"] = False
    segment_dict["submitted_by_actor_id"] = identity.actor_id

    strava_url = segment_dict.get("strava_url")
    if strava_url:
        segment_id = extract_strava_id(strava_url)
        if segment_id:
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
            segment_dict["strava_id"] = segment_id

            details = await fetch_segment_details(segment_id)
            if details:
                for key in ["polyline", "name", "distance_km", "gradient_pct"]:
                    if not segment_dict.get(key):
                        segment_dict[key] = details.get(key)

    result = await db.segments.insert_one(segment_dict)
    created_segment = await db.segments.find_one({"_id": result.inserted_id})
    return serialize_segment(created_segment)


@router.get("/api/segments", response_model=List[SegmentResponseSchema])
@limiter.limit("120/minute")
async def list_segments(request: Request):
    db = get_db()
    segments = await db.segments.find({"$or": [{"approved": True}, {"approved": {"$exists": False}}]}).to_list(100)
    report_counts = await get_block_report_counts(db, [segment["_id"] for segment in segments])
    now = datetime.now(timezone.utc)
    for segment in segments:
        await auto_unblock_if_needed(db, segment, now)
        serialize_segment(segment, report_counts.get(str(segment["_id"]), 0))
    return segments


@router.post("/api/segments/{segment_id}/report-blocked")
@limiter.limit("5/minute")
async def report_segment_blocked(
    request: Request,
    segment_id: str,
    data: BlockSchema = BlockSchema(),
    identity: ActorIdentity = Depends(verify_user),
):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    report_doc = {
        "segment_id": obj_id,
        "reported_by_actor_id": identity.actor_id,
        "reported_at": now_iso(),
        "blocked_until": data.blocked_until,
    }

    existing_report = await db.segment_block_reports.find_one(
        {"segment_id": obj_id, "reported_by_actor_id": identity.actor_id}
    )
    if existing_report:
        reports_count = await db.segment_block_reports.count_documents({"segment_id": obj_id})
        return {
            "status": "already_reported",
            "blocked": bool(segment.get("blocked", False)),
            "blocked_reports_count": reports_count,
            "threshold": BLOCK_REPORT_THRESHOLD,
        }

    try:
        await db.segment_block_reports.insert_one(report_doc)
    except DuplicateKeyError:
        reports_count = await db.segment_block_reports.count_documents({"segment_id": obj_id})
        return {
            "status": "already_reported",
            "blocked": bool(segment.get("blocked", False)),
            "blocked_reports_count": reports_count,
            "threshold": BLOCK_REPORT_THRESHOLD,
        }

    reports_count = await db.segment_block_reports.count_documents({"segment_id": obj_id})
    update: dict[str, object] = {}
    if reports_count >= BLOCK_REPORT_THRESHOLD:
        update["blocked"] = True
        if data.blocked_until:
            update["blocked_until"] = data.blocked_until

    if update:
        await db.segments.update_one({"_id": obj_id}, {"$set": update})

    return {
        "status": "reported",
        "blocked": reports_count >= BLOCK_REPORT_THRESHOLD or bool(segment.get("blocked", False)),
        "blocked_reports_count": reports_count,
        "threshold": BLOCK_REPORT_THRESHOLD,
    }


@router.delete("/api/segments/{segment_id}")
@limiter.limit("30/minute")
async def delete_segment(request: Request, segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})

    return {"status": "deleted"}
