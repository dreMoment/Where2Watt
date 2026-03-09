import logging

from fastapi import APIRouter, Depends, HTTPException, Request

import httpx
from config import ADMIN_STRAVA_IDS, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
from database import get_db
from dependencies import ActorIdentity, actor_id_from_strava_id, create_jwt, verify_active_user
from rate_limiter import limiter
from schemas import DisconnectResponseSchema, StravaCallbackSchema, UserResponseSchema
from services.account_cleanup import purge_actor_data
from services.segments import now_iso

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
