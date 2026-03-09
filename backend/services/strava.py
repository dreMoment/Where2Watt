import logging
from datetime import datetime, timezone

import httpx

from config import STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN

logger = logging.getLogger(__name__)


def _is_unexpired(expires_at: object) -> bool:
    if not isinstance(expires_at, (int, float)):
        return False
    return int(expires_at) > int(datetime.now(timezone.utc).timestamp()) + 30


async def _refresh_access_token(refresh_token: str) -> str | None:
    if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, refresh_token]):
        return None

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
        return response.json().get("access_token")


async def get_strava_access_token(db=None, actor_id: str | None = None):
    if db is not None and actor_id:
        auth_doc = await db.strava_auth.find_one({"actor_id": actor_id})
        if isinstance(auth_doc, dict):
            access_token = auth_doc.get("access_token")
            if isinstance(access_token, str) and access_token and _is_unexpired(auth_doc.get("expires_at")):
                return access_token

            refresh_token = auth_doc.get("refresh_token")
            if isinstance(refresh_token, str) and refresh_token:
                refreshed = await _refresh_access_token(refresh_token)
                if refreshed:
                    return refreshed

    if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN]):
        logger.warning("Missing Strava credentials")
        return None

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "refresh_token": STRAVA_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        logger.warning("Failed to get Strava token")
    return None


async def fetch_segment_details(segment_id: str, db=None, actor_id: str | None = None):
    if not segment_id:
        return None

    access_token = await get_strava_access_token(db=db, actor_id=actor_id)
    if not access_token:
        return None

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.strava.com/api/v3/segments/{segment_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code == 200:
            data = response.json()
            return {
                "polyline": data.get("map", {}).get("polyline"),
                "name": data.get("name"),
                "distance_km": round(data.get("distance", 0) / 1000 if data.get("distance") else 0, 2),
                "gradient_pct": round(data.get("average_grade", data.get("avg_grade", 0)), 1),
            }
        logger.warning("Failed to fetch segment from Strava")
    return None
