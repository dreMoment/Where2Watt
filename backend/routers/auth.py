from fastapi import APIRouter, Depends, HTTPException, Request

import httpx
from config import ADMIN_STRAVA_IDS, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
from dependencies import ActorIdentity, actor_id_from_strava_id, create_jwt, verify_user
from rate_limiter import limiter
from schemas import StravaCallbackSchema, UserResponseSchema

router = APIRouter()


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

    actor_id = actor_id_from_strava_id(strava_id)
    is_admin = strava_id in ADMIN_STRAVA_IDS

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
async def get_current_user(request: Request, identity: ActorIdentity = Depends(verify_user)):
    return {
        "actor_id": identity.actor_id,
        "is_admin": identity.is_admin,
    }
