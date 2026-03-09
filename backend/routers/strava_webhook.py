import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Request

from config import STRAVA_WEBHOOK_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN
from database import get_db
from dependencies import actor_id_from_strava_id
from rate_limiter import limiter
from services.account_cleanup import purge_actor_data

router = APIRouter()
logger = logging.getLogger(__name__)


def _coerce_int(value) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _is_deauthorization_event(payload: dict) -> bool:
    if payload.get("object_type") != "athlete":
        return False

    aspect_type = payload.get("aspect_type")
    if aspect_type == "delete":
        return True

    updates = payload.get("updates")
    if aspect_type != "update" or not isinstance(updates, dict):
        return False

    authorized_value = updates.get("authorized")
    if isinstance(authorized_value, bool):
        return authorized_value is False
    if isinstance(authorized_value, str):
        return authorized_value.strip().lower() == "false"
    return False


@router.get("/api/strava/webhook")
@limiter.limit("30/minute")
async def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    challenge = request.query_params.get("hub.challenge")
    verify_token = request.query_params.get("hub.verify_token")

    if mode != "subscribe":
        raise HTTPException(status_code=400, detail="Invalid hub.mode")
    if not challenge:
        raise HTTPException(status_code=400, detail="Missing hub.challenge")
    if not STRAVA_WEBHOOK_VERIFY_TOKEN:
        raise HTTPException(status_code=503, detail="Webhook verify token is not configured")
    if verify_token != STRAVA_WEBHOOK_VERIFY_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid verify token")

    return {"hub.challenge": challenge}


@router.post("/api/strava/webhook")
@limiter.limit("120/minute")
async def receive_webhook(request: Request):
    if not STRAVA_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret is not configured")

    signature = request.headers.get("x-strava-signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing webhook signature")

    raw_body = await request.body()
    expected_signature = hmac.new(
        STRAVA_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    processed = False
    athlete_id = _coerce_int(payload.get("object_id"))
    if athlete_id and _is_deauthorization_event(payload):
        actor_id = actor_id_from_strava_id(athlete_id)
        await purge_actor_data(get_db(), actor_id)
        processed = True
        logger.info("Processed Strava deauthorization webhook for athlete_id=%s", athlete_id)

    return {"status": "received", "processed": processed}
