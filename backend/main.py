import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict
from typing import List, Annotated
from bson import ObjectId
import httpx
from datetime import datetime, timezone
import re

# MongoDB Connection Parameters
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://db:27017")

# Strava API Config
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

# Admin Config
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

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

def extract_strava_id(strava_url: str) -> str | None:
    """Extracts the segment ID from a Strava segment URL."""
    if not strava_url:
        return None
    match = re.search(r"segments/(\d+)", strava_url)
    return match.group(1) if match else None

class SegmentSchema(BaseModel):
    name: str | None = None
    polyline: str | None = None
    strava_url: str | None = None
    distance_km: float | None = None
    gradient_pct: float | None = None
    approved: bool | None = False
    created_at: str | None = None
    
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

def verify_admin(x_admin_password: Annotated[str, Header()] = None):
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.post("/api/admin/verify")
async def verify_admin_password(is_admin: bool = Depends(verify_admin)):
    return {"status": "ok"}

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

async def fetch_segment_details(segment_id: str):
    if not segment_id:
        return None
    
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
    segment_dict["created_at"] = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    segment_dict["approved"] = False # Force explicit false

    
    strava_url = segment_dict.get("strava_url")
    if strava_url:
        segment_id = extract_strava_id(strava_url)
        if segment_id:
            existing = await db.segments.find_one({
                "$or": [
                    {"strava_id": segment_id},
                    {"strava_url": {"$regex": f"segments/{segment_id}(?![0-9])"}}
                ]
            })
            if existing:
                raise HTTPException(status_code=400, detail="Segment already exists")
            segment_dict["strava_id"] = segment_id

            # Try to fetch polyline and details if missing and we have a strava_url
            details = await fetch_segment_details(segment_id)
            if details:
                for key in ["polyline", "name", "distance_km", "gradient_pct"]:
                    if not segment_dict.get(key):
                        segment_dict[key] = details.get(key)

    # No terrain mapping needed

    result = await db.segments.insert_one(segment_dict)
    
    created_segment = await db.segments.find_one({"_id": result.inserted_id})
    if created_segment:
        created_segment["id"] = str(created_segment["_id"])
        del created_segment["_id"]
    return created_segment

@app.get("/api/segments", response_model=List[SegmentResponseSchema])
async def list_segments():
    db = db_client.findmyintervals
    segments = await db.segments.find({
        "$or": [{"approved": True}, {"approved": {"$exists": False}}]
    }).to_list(100)
    for segment in segments:
        segment["id"] = str(segment["_id"])
        del segment["_id"]
    return segments

@app.get("/api/admin/segments/unapproved", response_model=List[SegmentResponseSchema])
async def list_unapproved_segments(is_admin: bool = Depends(verify_admin)):
    db = db_client.findmyintervals
    segments = await db.segments.find({"approved": False}).sort("created_at", -1).to_list(100)
    for segment in segments:
        segment["id"] = str(segment["_id"])
        del segment["_id"]
    return segments

@app.post("/api/admin/segments/{segment_id}/approve")
async def approve_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = db_client.findmyintervals
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")
    
    result = await db.segments.update_one(
        {"_id": obj_id},
        {"$set": {"approved": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    return {"status": "approved"}

@app.delete("/api/segments/{segment_id}")
async def delete_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = db_client.findmyintervals
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")
    
    result = await db.segments.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    return {"status": "deleted"}
