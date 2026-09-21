import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request

import httpx
from config import ADMIN_STRAVA_IDS, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
from database import get_db
from dependencies import ActorIdentity, actor_id_from_strava_id, create_jwt, verify_active_user
from rate_limiter import limiter
from schemas import (
    DisconnectResponseSchema,
    StravaCallbackSchema,
    StravaSegmentPreviewResponseSchema,
    StarredSegmentResponseSchema,
    UserPreferencesSchema,
    UserPreferencesUpdateSchema,
    UserResponseSchema,
)
from services.account_cleanup import purge_actor_data
from services.preferences import normalize_user_preferences
from services.segments import now_iso
from services.strava import (
    exclude_existing_segments,
    fetch_segment_details,
    fetch_starred_segments,
    remember_and_sort_starred_segments,
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def _deauthorize_with_access_token(access_token: str) -> bool:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/deauthorize",
            data={"access_token": access_token},
        )
    return response.status_code == 200


async def _refresh_access_token(refresh_token: str) -> str | None:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if response.status_code != 200:
        return None
    token_data = response.json()
    token = token_data.get("access_token")
    if not isinstance(token, str) or not token:
        return None
    return token


@router.post("/api/auth/strava/callback")
@limiter.limit("10/minute")
async def strava_auth_callback(request: Request, data: StravaCallbackSchema):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "code": data.code,
                "grant_type": "authorization_code",
                "redirect_uri": data.redirect_uri,
            },
        )
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Strava")

        token_data = response.json()

    athlete = token_data.get("athlete", {})
    strava_id = athlete.get("id")
    if not strava_id:
        raise HTTPException(status_code=400, detail="No athlete data received from Strava")

    try:
        strava_id_int = int(strava_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="No athlete data received from Strava")
    actor_id = actor_id_from_strava_id(strava_id_int)
    is_admin = strava_id_int in ADMIN_STRAVA_IDS
    db = get_db()
    await db.strava_auth.update_one(
        {"actor_id": actor_id},
        {
            "$set": {
                "actor_id": actor_id,
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"),
                "scope": token_data.get("scope"),
                "expires_at": token_data.get("expires_at"),
                "updated_at": now_iso(),
            }
        },
        upsert=True,
    )
    await db.revoked_actors.delete_many({"actor_id": actor_id})

    token = create_jwt(actor_id=actor_id, is_admin=is_admin)

    return {
        "token": token,
        "user": {
            "actor_id": actor_id,
            "is_admin": is_admin,
        },
    }


@router.get("/api/auth/me", response_model=UserResponseSchema)
@limiter.limit("60/minute")
async def get_current_user(request: Request, identity: ActorIdentity = Depends(verify_active_user)):
    return {
        "actor_id": identity.actor_id,
        "is_admin": identity.is_admin,
    }


@router.get("/api/strava/segments/starred", response_model=list[StarredSegmentResponseSchema])
@limiter.limit("30/minute")
async def get_starred_strava_segments(
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=100, ge=1, le=100),
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    segments = await fetch_starred_segments(
        db=db,
        actor_id=identity.actor_id,
        page=page,
        per_page=per_page,
    )
    if segments is None:
        raise HTTPException(status_code=502, detail="Could not load your starred Strava segments. Please try again.")
    if not segments:
        return []
    segments = await remember_and_sort_starred_segments(db, identity.actor_id, segments)

    starred_ids = [segment["id"] for segment in segments]
    stored_id_variants: list[str | int] = [*starred_ids, *(int(value) for value in starred_ids if value.isdigit())]
    url_pattern = "segments/(?:" + "|".join(re.escape(value) for value in starred_ids) + ")(?![0-9])"
    existing_segments = await db.segments.find(
        {
            "$or": [
                {"strava_id": {"$in": stored_id_variants}},
                {"aliases": {"$in": stored_id_variants}},
                {"strava_url": {"$regex": url_pattern}},
            ]
        },
        {"_id": 0, "strava_id": 1, "aliases": 1, "strava_url": 1, "approved": 1},
    ).to_list(length=len(starred_ids))
    approved_segments = [
        segment for segment in existing_segments
        if segment.get("approved", True) is not False
    ]
    return exclude_existing_segments(segments, approved_segments)


@router.get("/api/strava/segments/{segment_id}/preview", response_model=StravaSegmentPreviewResponseSchema)
@limiter.limit("30/minute")
async def preview_strava_segment(
    request: Request,
    segment_id: str,
    identity: ActorIdentity = Depends(verify_active_user),
):
    if not segment_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid Strava segment ID.")

    details = await fetch_segment_details(segment_id, db=get_db(), actor_id=identity.actor_id)
    if not details or not details.get("polyline"):
        raise HTTPException(status_code=502, detail="Could not load segment details from Strava. Please try again.")

    return {
        "id": segment_id,
        "strava_url": f"https://www.strava.com/segments/{segment_id}",
        **details,
    }


@router.get("/api/auth/preferences", response_model=UserPreferencesSchema)
@limiter.limit("60/minute")
async def get_user_preferences(request: Request, identity: ActorIdentity = Depends(verify_active_user)):
    db = get_db()
    doc = await db.user_preferences.find_one({"actor_id": identity.actor_id})
    return normalize_user_preferences(doc)


@router.patch("/api/auth/preferences", response_model=UserPreferencesSchema)
@limiter.limit("30/minute")
async def update_user_preferences(
    request: Request,
    payload: UserPreferencesUpdateSchema,
    identity: ActorIdentity = Depends(verify_active_user),
):
    db = get_db()
    update_payload = payload.model_dump(exclude_unset=True, exclude_none=True)
    update_payload["actor_id"] = identity.actor_id
    update_payload["updated_at"] = now_iso()

    await db.user_preferences.update_one(
        {"actor_id": identity.actor_id},
        {"$set": update_payload},
        upsert=True,
    )

    doc = await db.user_preferences.find_one({"actor_id": identity.actor_id})
    return normalize_user_preferences(doc)


@router.post("/api/auth/disconnect", response_model=DisconnectResponseSchema)
@limiter.limit("10/minute")
async def disconnect_strava(request: Request, identity: ActorIdentity = Depends(verify_active_user)):
    db = get_db()
    auth_doc = await db.strava_auth.find_one({"actor_id": identity.actor_id})

    deauthorized_with_strava = False
    access_token = auth_doc.get("access_token") if isinstance(auth_doc, dict) else None
    refresh_token = auth_doc.get("refresh_token") if isinstance(auth_doc, dict) else None

    if isinstance(access_token, str) and access_token:
        deauthorized_with_strava = await _deauthorize_with_access_token(access_token)

    if not deauthorized_with_strava and isinstance(refresh_token, str) and refresh_token:
        refreshed_access_token = await _refresh_access_token(refresh_token)
        if refreshed_access_token:
            deauthorized_with_strava = await _deauthorize_with_access_token(refreshed_access_token)

    if not deauthorized_with_strava and (access_token or refresh_token):
        logger.warning("Failed to deauthorize with Strava for actor_id=%s", identity.actor_id)

    deleted = await purge_actor_data(db, identity.actor_id)
    return {
        "status": "disconnected",
        "deauthorized_with_strava": deauthorized_with_strava,
        "deleted": deleted,
    }
