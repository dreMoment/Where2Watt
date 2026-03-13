import logging
from datetime import datetime, timezone

import httpx

from config import ADMIN_DISCORD_WEBHOOK_URL

logger = logging.getLogger(__name__)


def _format_timestamp(timestamp: str | None) -> str:
    if not timestamp:
        return datetime.now(timezone.utc).isoformat()
    return timestamp


async def notify_new_segment_submission(
    *,
    strava_url: str | None,
    segment_name: str | None,
    submitted_by_actor_id: str,
    created_at: str | None = None,
) -> None:
    webhook_url = (ADMIN_DISCORD_WEBHOOK_URL or "").strip()
    if not webhook_url:
        return

    display_name = segment_name.strip() if isinstance(segment_name, str) else ""
    title = display_name if display_name else "Unnamed Segment"
    link = (strava_url or "").strip() or "N/A"
    submitted_at = _format_timestamp(created_at)
    content = (
        "New segment submitted for review\n"
        f"Name: {title}\n"
        f"Strava: {link}\n"
        f"Submitted by: `{submitted_by_actor_id}`\n"
        f"Created at: `{submitted_at}`"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(webhook_url, json={"content": content})
            response.raise_for_status()
    except Exception:
        logger.exception("Failed to send Discord notification for new segment submission")
