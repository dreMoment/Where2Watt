from datetime import datetime, timedelta, timezone

from config import JWT_EXPIRATION_HOURS
from services.segments import now_iso


async def purge_actor_data(db, actor_id: str) -> dict[str, int]:
    revoked_until = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)


    deleted_actor_ratings = (await db.segment_ratings.delete_many({"rated_by_actor_id": actor_id})).deleted_count
    deleted_actor_reports = (
        await db.segment_block_reports.delete_many({"reported_by_actor_id": actor_id})
    ).deleted_count
    deleted_auth_rows = (await db.strava_auth.delete_many({"actor_id": actor_id})).deleted_count

    await db.revoked_actors.update_one(
        {"actor_id": actor_id},
        {
            "$set": {
                "actor_id": actor_id,
                "revoked_at": now_iso(),
                "revoked_until": revoked_until,
            }
        },
        upsert=True,
    )

    return {
        "actor_ratings_deleted": deleted_actor_ratings,
        "actor_reports_deleted": deleted_actor_reports,
        "strava_auth_rows_deleted": deleted_auth_rows,
    }
