from fastapi import APIRouter, Depends, HTTPException, Request

import httpx
from config import STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
from database import get_db
from dependencies import create_jwt, verify_user
from rate_limiter import limiter
from schemas import StravaCallbackSchema, UserResponseSchema
from services.segments import now_iso

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

    db = get_db()
    now = now_iso()
    user_doc = {
        "strava_id": strava_id,
        "username": athlete.get("username"),
        "firstname": athlete.get("firstname"),
        "lastname": athlete.get("lastname"),
        "profile_pic": athlete.get("profile"),
        "last_login": now,
    }
    await db.users.update_one(
        {"strava_id": strava_id},
        {"$set": user_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    token = create_jwt(strava_id)

    return {
        "token": token,
        "user": {
            "strava_id": strava_id,
            "username": athlete.get("username"),
            "firstname": athlete.get("firstname"),
            "lastname": athlete.get("lastname"),
            "profile_pic": athlete.get("profile"),
        },
    }


@router.get("/api/auth/me", response_model=UserResponseSchema)
async def get_current_user(strava_id: int = Depends(verify_user)):
    db = get_db()
    user = await db.users.find_one({"strava_id": strava_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "strava_id": user["strava_id"],
        "username": user.get("username"),
        "firstname": user.get("firstname"),
        "lastname": user.get("lastname"),
        "profile_pic": user.get("profile_pic"),
    }
