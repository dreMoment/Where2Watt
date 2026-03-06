import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

from config import MONGODB_DB_NAME, MONGODB_URI

logger = logging.getLogger(__name__)

db_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_client
    logger.info("Connecting to MongoDB")
    db_client = AsyncIOMotorClient(MONGODB_URI)
    db = db_client[MONGODB_DB_NAME]
    await db.segment_block_reports.create_index(
        [("segment_id", 1), ("reported_by_actor_id", 1), ("action", 1)],
        unique=True,
    )
    await db.segment_block_reports.create_index([("segment_id", 1), ("reported_at", -1)])
    await db.segment_ratings.create_index([("segment_id", 1), ("rated_by_actor_id", 1)], unique=True)
    await db.segment_ratings.create_index([("segment_id", 1), ("rated_at", -1)])
    yield
    logger.info("Disconnecting from MongoDB")
    db_client.close()


def get_db():
    if db_client is None:
        raise RuntimeError("Database client is not initialized")
    return db_client[MONGODB_DB_NAME]
