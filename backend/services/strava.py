import logging

import httpx

from config import STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN

logger = logging.getLogger(__name__)


async def get_strava_access_token():
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


async def fetch_segment_details(segment_id: str):
    if not segment_id:
        return None

    access_token = await get_strava_access_token()
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
                "gradient_pct": round(data.get("average_grade", 0), 1),
            }
        logger.warning("Failed to fetch segment from Strava")
    return None
