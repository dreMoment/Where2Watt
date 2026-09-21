import logging
from datetime import datetime, timezone

import httpx
from pymongo import UpdateOne

from config import STRAVA_API_BASE_URL, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
from services.segments import extract_segment_effort_id, extract_strava_id

logger = logging.getLogger(__name__)


def _response_body(response) -> str:
    return str(getattr(response, "text", ""))[:500]


def _is_unexpired(expires_at: object) -> bool:
    if not isinstance(expires_at, (int, float)):
        return False
    return int(expires_at) > int(datetime.now(timezone.utc).timestamp()) + 30


async def _refresh_token_data(refresh_token: str) -> dict | None:
    if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, refresh_token]):
        return None

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": STRAVA_CLIENT_ID,
                    "client_secret": STRAVA_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
        except httpx.RequestError as exc:
            logger.warning("Failed to refresh Strava token: request_error=%s", exc)
            return None
        if response.status_code != 200:
            logger.warning("Failed to refresh Strava token: status=%s body=%s", response.status_code, _response_body(response))
            return None
        token_data = response.json()
        return token_data if isinstance(token_data.get("access_token"), str) else None


async def get_strava_access_token(db=None, actor_id: str | None = None):
    if db is not None and actor_id:
        auth_doc = await db.strava_auth.find_one({"actor_id": actor_id})
        if isinstance(auth_doc, dict):
            access_token = auth_doc.get("access_token")
            if isinstance(access_token, str) and access_token and _is_unexpired(auth_doc.get("expires_at")):
                return access_token

            refresh_token = auth_doc.get("refresh_token")
            if isinstance(refresh_token, str) and refresh_token:
                token_data = await _refresh_token_data(refresh_token)
                if token_data:
                    update = {
                        "access_token": token_data.get("access_token"),
                        "expires_at": token_data.get("expires_at"),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    if token_data.get("refresh_token"):
                        update["refresh_token"] = token_data.get("refresh_token")
                    await db.strava_auth.update_one({"actor_id": actor_id}, {"$set": update})
                    return token_data.get("access_token")

    if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN]):
        logger.warning("Missing Strava credentials")
        return None

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": STRAVA_CLIENT_ID,
                    "client_secret": STRAVA_CLIENT_SECRET,
                    "refresh_token": STRAVA_REFRESH_TOKEN,
                    "grant_type": "refresh_token",
                },
            )
        except httpx.RequestError as exc:
            logger.warning("Failed to get Strava token: request_error=%s", exc)
            return None
        if response.status_code == 200:
            return response.json().get("access_token")
        logger.warning("Failed to get Strava token: status=%s body=%s", response.status_code, _response_body(response))
    return None


async def fetch_segment_details(segment_id: str, db=None, actor_id: str | None = None):
    if not segment_id:
        return None

    access_token = await get_strava_access_token(db=db, actor_id=actor_id)
    if not access_token:
        return None

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{STRAVA_API_BASE_URL}/segments/{segment_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.RequestError as exc:
            logger.warning("Failed to fetch segment from Strava: request_error=%s", exc)
            return None
        if response.status_code == 200:
            data = response.json()
            return {
                "polyline": data.get("map", {}).get("polyline"),
                "name": data.get("name"),
                "distance_km": round(data.get("distance", 0) / 1000 if data.get("distance") else 0, 2),
                "gradient_pct": round(data.get("average_grade", data.get("avg_grade", 0)), 1),
            }
        logger.warning("Failed to fetch segment from Strava: status=%s body=%s", response.status_code, _response_body(response))
    return None


async def fetch_starred_segments(db, actor_id: str, page: int = 1, per_page: int = 100) -> list[dict] | None:
    """Return a normalized page of the authenticated athlete's starred segments."""
    access_token = await get_strava_access_token(db=db, actor_id=actor_id)
    if not access_token:
        return None

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{STRAVA_API_BASE_URL}/segments/starred",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"page": page, "per_page": per_page},
            )
        except httpx.RequestError as exc:
            logger.warning("Failed to fetch starred Strava segments: request_error=%s", exc)
            return None

    if response.status_code != 200:
        logger.warning(
            "Failed to fetch starred Strava segments: status=%s body=%s",
            response.status_code,
            _response_body(response),
        )
        return None

    payload = response.json()
    if not isinstance(payload, list):
        return None

    segments = []
    for item in payload:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        distance_m = item.get("distance")
        elevation_m = item.get("elev_difference")
        segments.append(
            {
                "id": str(item["id"]),
                "name": str(item.get("name") or "Unnamed segment"),
                "distance_km": round(float(distance_m) / 1000, 2) if isinstance(distance_m, (int, float)) else None,
                "elevation_m": round(float(elevation_m)) if isinstance(elevation_m, (int, float)) else None,
            }
        )
    return segments


def exclude_existing_segments(starred_segments: list[dict], existing_segments: list[dict]) -> list[dict]:
    existing_ids: set[str] = set()
    for segment in existing_segments:
        strava_id = segment.get("strava_id")
        if strava_id is not None:
            existing_ids.add(str(strava_id))
        aliases = segment.get("aliases")
        if isinstance(aliases, list):
            existing_ids.update(str(alias) for alias in aliases if alias is not None)
        url_id = extract_strava_id(str(segment.get("strava_url") or ""))
        if url_id:
            existing_ids.add(url_id)

    return [segment for segment in starred_segments if str(segment.get("id")) not in existing_ids]


async def remember_and_sort_starred_segments(db, actor_id: str, segments: list[dict]) -> list[dict]:
    """Put segments first when this app observes them for the first time."""
    if not segments:
        return segments

    segment_ids = [str(segment["id"]) for segment in segments]
    sightings = await db.starred_segment_sightings.find(
        {"actor_id": actor_id, "segment_id": {"$in": segment_ids}},
        {"_id": 0, "segment_id": 1, "first_seen_at": 1},
    ).to_list(length=len(segment_ids))
    first_seen_by_id = {
        str(sighting["segment_id"]): str(sighting["first_seen_at"])
        for sighting in sightings
        if sighting.get("segment_id") is not None and sighting.get("first_seen_at")
    }

    observed_at = datetime.now(timezone.utc).isoformat()
    unseen_ids = [segment_id for segment_id in segment_ids if segment_id not in first_seen_by_id]
    if unseen_ids:
        await db.starred_segment_sightings.bulk_write([
            UpdateOne(
                {"actor_id": actor_id, "segment_id": segment_id},
                {"$setOnInsert": {
                    "actor_id": actor_id,
                    "segment_id": segment_id,
                    "first_seen_at": observed_at,
                }},
                upsert=True,
            )
            for segment_id in unseen_ids
        ])
        first_seen_by_id.update({segment_id: observed_at for segment_id in unseen_ids})

    return sorted(
        segments,
        key=lambda segment: first_seen_by_id.get(str(segment["id"]), ""),
        reverse=True,
    )


async def fetch_segment_id_from_effort(segment_effort_id: str, db=None, actor_id: str | None = None) -> str | None:
    if not segment_effort_id:
        return None

    access_token = await get_strava_access_token(db=db, actor_id=actor_id)
    if not access_token:
        return None

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{STRAVA_API_BASE_URL}/segment_efforts/{segment_effort_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.RequestError as exc:
            logger.warning("Failed to fetch segment effort from Strava: request_error=%s", exc)
            return None
        if response.status_code != 200:
            logger.warning("Failed to fetch segment effort from Strava: status=%s body=%s", response.status_code, _response_body(response))
            return None
        segment = response.json().get("segment")
        segment_id = segment.get("id") if isinstance(segment, dict) else None
        return str(segment_id) if segment_id else None


async def resolve_segment_id_from_strava_url(strava_url: str, db=None, actor_id: str | None = None) -> str | None:
    segment_id = extract_strava_id(strava_url)
    if segment_id:
        return segment_id

    segment_effort_id = extract_segment_effort_id(strava_url)
    if not segment_effort_id:
        return None

    return await fetch_segment_id_from_effort(segment_effort_id, db=db, actor_id=actor_id)
