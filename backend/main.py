import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict
from bson import ObjectId
from typing import List
import httpx
import re

# MongoDB Connection Parameters
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://db:27017")

# Strava API Config
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

# Global DB Client
db_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_client
    # Startup
    print(f"Connecting to MongoDB at {MONGODB_URI}")
    db_client = AsyncIOMotorClient(MONGODB_URI)
    yield
    # Shutdown
    print("Disconnecting from MongoDB")
    db_client.close()

app = FastAPI(lifespan=lifespan, title="FindMyIntervals API")

# Add CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        from pydantic_core import core_schema
        return core_schema.union_schema([
            core_schema.str_schema(),
            core_schema.is_instance_schema(ObjectId),
        ])

class SegmentSchema(BaseModel):
    name: str | None = None
    terrain: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    polyline: str | None = None
    strava_url: str | None = None
    distance_km: float | None = None
    gradient_pct: float | None = None
    
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="allow")

class SegmentResponseSchema(SegmentSchema):
    id: str
    
@app.get("/health")
async def health_check():
    try:
        # Check DB connection
        await db_client.admin.command('ping')
        return {"status": "ok", "db_connected": True}
    except Exception as e:
        return {"status": "error", "db_connected": False, "error": str(e)}

async def get_strava_access_token():
    if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN]):
        print("Missing Strava credentials")
        return None
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "refresh_token": STRAVA_REFRESH_TOKEN,
                "grant_type": "refresh_token"
            }
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            print(f"Failed to get Strava token: {response.text}")
    return None

async def fetch_segment_details(strava_url: str):
    if not strava_url:
        return None
    match = re.search(r"segments/(\d+)", strava_url)
    if not match:
        return None
    segment_id = match.group(1)
    
    access_token = await get_strava_access_token()
    if not access_token:
        return None
        
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.strava.com/api/v3/segments/{segment_id}",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            return {
                "polyline": data.get("map", {}).get("polyline"),
                "name": data.get("name"),
                "distance_km": round(data.get("distance", 0) / 1000 if data.get("distance") else 0, 2),
                "gradient_pct": round(data.get("average_grade", 0), 1)
            }
        else:
            print(f"Failed to fetch segment from Strava: {response.text}")
    return None

@app.post("/api/segments", response_model=SegmentResponseSchema, status_code=201)
async def create_segment(segment: SegmentSchema):
    db = db_client.findmyintervals
    segment_dict = segment.model_dump()
    
    # Try to fetch polyline and details if missing and we have a strava_url
    if segment_dict.get("strava_url"):
        details = await fetch_segment_details(segment_dict["strava_url"])
        if details:
            if not segment_dict.get("polyline"):
                segment_dict["polyline"] = details["polyline"]
            if not segment_dict.get("name"):
                segment_dict["name"] = details["name"]
            if not segment_dict.get("distance_km"):
                segment_dict["distance_km"] = details["distance_km"]
            if not segment_dict.get("gradient_pct"):
                segment_dict["gradient_pct"] = details["gradient_pct"]

    result = await db.segments.insert_one(segment_dict)
    
    created_segment = await db.segments.find_one({"_id": result.inserted_id})
    if created_segment:
        created_segment["id"] = str(created_segment["_id"])
        del created_segment["_id"]
    return created_segment

@app.get("/api/segments", response_model=List[SegmentResponseSchema])
async def list_segments():
    db = db_client.findmyintervals
    segments = await db.segments.find().to_list(100)
    for segment in segments:
        segment["id"] = str(segment["_id"])
        del segment["_id"]
    return segments
