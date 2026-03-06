from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from database import get_db
from dependencies import ActorIdentity, verify_admin, verify_user
from rate_limiter import limiter
from schemas import SegmentReportSchema, SegmentResponseSchema, SegmentSchema
from services.segments import (
    extract_strava_id,
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
    for segment in segments:
        serialize_segment(segment)
    return segments


@router.post("/api/segments/{segment_id}/report-blocked")
@limiter.limit("5/minute")
async def report_segment_blocked(
    request: Request,
    segment_id: str,
    data: SegmentReportSchema = SegmentReportSchema(),
    identity: ActorIdentity = Depends(verify_user),
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
    identity: ActorIdentity = Depends(verify_user),
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
async def get_my_report_status(request: Request, segment_id: str, identity: ActorIdentity = Depends(verify_user)):
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
