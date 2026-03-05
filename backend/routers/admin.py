from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request

from config import BLOCK_REPORT_THRESHOLD
from database import get_db
from dependencies import verify_admin
from rate_limiter import limiter
from schemas import BlockSchema, QuickAddSchema, SegmentResponseSchema
from services.segments import (
    enrich_admin_segment_users,
    extract_strava_id,
    get_block_report_counts,
    now_iso,
    parse_object_id,
    serialize_segment,
)
from services.strava import fetch_segment_details

router = APIRouter()


@router.post("/api/admin/verify")
@limiter.limit("5/minute")
async def verify_admin_password(request: Request, is_admin: bool = Depends(verify_admin)):
    return {"status": "ok"}


@router.get("/api/admin/segments/unapproved", response_model=List[SegmentResponseSchema])
async def list_unapproved_segments(is_admin: bool = Depends(verify_admin)):
    db = get_db()
    segments = await db.segments.find({"approved": False}).sort("created_at", -1).to_list(100)
    report_counts = await get_block_report_counts(db, [segment["_id"] for segment in segments])
    await enrich_admin_segment_users(db, segments)
    for segment in segments:
        serialize_segment(segment, report_counts.get(str(segment["_id"]), 0))
    return segments


@router.get("/api/admin/segments", response_model=List[SegmentResponseSchema])
async def list_all_segments(is_admin: bool = Depends(verify_admin)):
    db = get_db()
    segments = await db.segments.find().sort("created_at", -1).to_list(500)
    report_counts = await get_block_report_counts(db, [segment["_id"] for segment in segments])
    await enrich_admin_segment_users(db, segments)
    for segment in segments:
        serialize_segment(segment, report_counts.get(str(segment["_id"]), 0))
    return segments


@router.get("/api/admin/segments/{segment_id}/blocked-reports")
async def list_block_reports_for_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    reports = await db.segment_block_reports.find({"segment_id": obj_id}).sort("reported_at", -1).to_list(200)
    return {
        "segment_id": segment_id,
        "reports_count": len(reports),
        "threshold": BLOCK_REPORT_THRESHOLD,
        "reports": [
            {
                "reported_by_strava_id": report["reported_by_strava_id"],
                "reported_at": report["reported_at"],
                "blocked_until": report.get("blocked_until"),
            }
            for report in reports
        ],
    }


@router.post("/api/admin/segments/{segment_id}/approve")
async def approve_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"approved": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "approved"}


@router.patch("/api/admin/segments/{segment_id}/block")
async def block_segment(segment_id: str, data: BlockSchema = BlockSchema(), is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    update = {"blocked": True}
    if data.blocked_until:
        update["blocked_until"] = data.blocked_until
    else:
        update["blocked_until"] = None

    result = await db.segments.update_one({"_id": obj_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "blocked"}


@router.patch("/api/admin/segments/{segment_id}/unblock")
async def unblock_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = get_db()
    obj_id = parse_object_id(segment_id)

    result = await db.segments.update_one({"_id": obj_id}, {"$set": {"blocked": False, "blocked_until": None}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"status": "unblocked"}


@router.post("/api/admin/segments/quickadd", response_model=SegmentResponseSchema, status_code=201)
async def quick_add_segment(data: QuickAddSchema, is_admin: bool = Depends(verify_admin)):
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
    return serialize_segment(created_segment)
