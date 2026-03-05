import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, ConfigDict
from typing import List, Annotated, Optional
from bson import ObjectId
import httpx
from datetime import datetime, timezone
import re
import jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Reporting config
BLOCK_REPORT_THRESHOLD = 2

# MongoDB Connection Parameters
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME")

# Strava API Config
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

# Auth Config
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days

# Admin Config
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable must be set")

# CORS Config
CORS_ORIGIN = os.getenv("CORS_ORIGIN")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGIN.split(",")]

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Global DB Client
db_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_client
    # Startup
    print(f"Connecting to MongoDB at {MONGODB_URI}")
    db_client = AsyncIOMotorClient(MONGODB_URI)
    db = db_client[MONGODB_DB_NAME]
    await db.segment_block_reports.create_index(
        [("segment_id", 1), ("reported_by_strava_id", 1)],
        unique=True
    )
    await db.segment_block_reports.create_index([("segment_id", 1), ("reported_at", -1)])
    yield
    # Shutdown
    print("Disconnecting from MongoDB")
    db_client.close()

app = FastAPI(lifespan=lifespan, title="FindMyIntervals API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
    strava_id: str | None = None
    created_at: str | None = None
    blocked: bool | None = False
    blocked_until: str | None = None
    
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="ignore")

class QuickAddSchema(BaseModel):
    strava_url: str

class BlockSchema(BaseModel):
    blocked_until: str | None = None

class SegmentResponseSchema(SegmentSchema):
    id: str
    added_by_strava_id: int | None = None
    submitted_by_strava_id: int | None = None
    blocked_report_count: int | None = 0

class StravaCallbackSchema(BaseModel):
    code: str
    redirect_uri: str

class UserResponseSchema(BaseModel):
    strava_id: int
    username: str | None = None
    firstname: str | None = None
    lastname: str | None = None
    profile_pic: str | None = None


async def get_block_report_counts(db, segment_object_ids: list[ObjectId]) -> dict[str, int]:
    if not segment_object_ids:
        return {}

    pipeline = [
        {"$match": {"segment_id": {"$in": segment_object_ids}}},
        {"$group": {"_id": "$segment_id", "count": {"$sum": 1}}}
    ]
    grouped = await db.segment_block_reports.aggregate(pipeline).to_list(length=None)
    return {str(item["_id"]): item["count"] for item in grouped}
    
@app.get("/health")
async def health_check():
    try:
        # Check DB connection
        await db_client.admin.command('ping')
        return {"status": "ok", "db_connected": True}
    except Exception:
        return {"status": "error", "db_connected": False}

def verify_admin(x_admin_password: Annotated[str, Header()] = None):
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

def verify_user(authorization: Annotated[str, Header()] = None) -> int:
    """Verify JWT token and return the user's Strava ID."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["strava_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")

def create_jwt(strava_id: int) -> str:
    """Create a JWT token for the given Strava athlete ID."""
    payload = {
        "strava_id": strava_id,
        "exp": datetime.now(timezone.utc).timestamp() + JWT_EXPIRATION_HOURS * 3600,
        "iat": datetime.now(timezone.utc).timestamp(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

@app.post("/api/admin/verify")
@limiter.limit("5/minute")
async def verify_admin_password(request: Request, is_admin: bool = Depends(verify_admin)):
    return {"status": "ok"}

# ===== Auth Endpoints =====

@app.post("/api/auth/strava/callback")
@limiter.limit("10/minute")
async def strava_auth_callback(request: Request, data: StravaCallbackSchema):
    """Exchange Strava auth code for tokens, upsert user, return JWT."""
    print(f"Received code from frontend: '{data.code}'")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "code": data.code,
                "grant_type": "authorization_code",
                "redirect_uri": data.redirect_uri
            }
        )
        if response.status_code != 200:
            print(f"Strava auth failed. Code: {response.status_code}, Body: {response.text}")
            raise HTTPException(status_code=400, detail="Failed to authenticate with Strava")
        
        token_data = response.json()
    
    athlete = token_data.get("athlete", {})
    strava_id = athlete.get("id")
    if not strava_id:
        raise HTTPException(status_code=400, detail="No athlete data received from Strava")
    
    # Upsert user in database
    db = db_client[MONGODB_DB_NAME]
    now = datetime.now(timezone.utc).isoformat()
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
        upsert=True
    )
    
    # Create JWT
    token = create_jwt(strava_id)
    
    return {
        "token": token,
        "user": {
            "strava_id": strava_id,
            "username": athlete.get("username"),
            "firstname": athlete.get("firstname"),
            "lastname": athlete.get("lastname"),
            "profile_pic": athlete.get("profile"),
        }
    }

@app.get("/api/auth/me", response_model=UserResponseSchema)
async def get_current_user(strava_id: int = Depends(verify_user)):
    """Return the current user's profile."""
    db = db_client[MONGODB_DB_NAME]
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
@limiter.limit("10/minute")
async def create_segment(request: Request, segment: SegmentSchema, strava_id: int = Depends(verify_user)):
    db = db_client[MONGODB_DB_NAME]
    segment_dict = segment.model_dump()
    segment_dict["created_at"] = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    segment_dict["approved"] = False # Force explicit false
    segment_dict["added_by_strava_id"] = strava_id
    segment_dict["submitted_by_strava_id"] = strava_id

    
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
    db = db_client[MONGODB_DB_NAME]
    segments = await db.segments.find({
        "$or": [{"approved": True}, {"approved": {"$exists": False}}]
    }).to_list(100)
    report_counts = await get_block_report_counts(db, [segment["_id"] for segment in segments])
    now = datetime.now(timezone.utc)
    for segment in segments:
        # Auto-unblock segments whose blocked_until has passed
        if segment.get("blocked") and segment.get("blocked_until"):
            try:
                until = datetime.fromisoformat(segment["blocked_until"])
                if until <= now:
                    await db.segments.update_one(
                        {"_id": segment["_id"]},
                        {"$set": {"blocked": False, "blocked_until": None}}
                    )
                    segment["blocked"] = False
                    segment["blocked_until"] = None
            except (ValueError, TypeError):
                pass
        segment["blocked_report_count"] = report_counts.get(str(segment["_id"]), 0)
        segment["id"] = str(segment["_id"])
        del segment["_id"]
    return segments

@app.post("/api/segments/{segment_id}/report-blocked")
@limiter.limit("5/minute")
async def report_segment_blocked(request: Request, segment_id: str, data: BlockSchema = BlockSchema(), strava_id: int = Depends(verify_user)):
    db = db_client[MONGODB_DB_NAME]
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    report_doc = {
        "segment_id": obj_id,
        "reported_by_strava_id": strava_id,
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "blocked_until": data.blocked_until
    }

    existing_report = await db.segment_block_reports.find_one({
        "segment_id": obj_id,
        "reported_by_strava_id": strava_id
    })
    if existing_report:
        reports_count = await db.segment_block_reports.count_documents({"segment_id": obj_id})
        return {
            "status": "already_reported",
            "blocked": bool(segment.get("blocked", False)),
            "blocked_reports_count": reports_count,
            "threshold": BLOCK_REPORT_THRESHOLD
        }

    try:
        await db.segment_block_reports.insert_one(report_doc)
    except DuplicateKeyError:
        reports_count = await db.segment_block_reports.count_documents({"segment_id": obj_id})
        return {
            "status": "already_reported",
            "blocked": bool(segment.get("blocked", False)),
            "blocked_reports_count": reports_count,
            "threshold": BLOCK_REPORT_THRESHOLD
        }
    reports_count = await db.segment_block_reports.count_documents({"segment_id": obj_id})

    update: dict[str, object] = {"blocked_report_count": reports_count}
    if reports_count >= BLOCK_REPORT_THRESHOLD:
        update["blocked"] = True
        if data.blocked_until:
            update["blocked_until"] = data.blocked_until

    await db.segments.update_one(
        {"_id": obj_id},
        {"$set": update}
    )

    return {
        "status": "reported",
        "blocked": reports_count >= BLOCK_REPORT_THRESHOLD or bool(segment.get("blocked", False)),
        "blocked_reports_count": reports_count,
        "threshold": BLOCK_REPORT_THRESHOLD
    }

@app.get("/api/admin/segments/unapproved", response_model=List[SegmentResponseSchema])
async def list_unapproved_segments(is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    segments = await db.segments.find({"approved": False}).sort("created_at", -1).to_list(100)
    report_counts = await get_block_report_counts(db, [segment["_id"] for segment in segments])
    for segment in segments:
        segment["blocked_report_count"] = report_counts.get(str(segment["_id"]), 0)
        segment["id"] = str(segment["_id"])
        del segment["_id"]
    return segments

@app.get("/api/admin/segments", response_model=List[SegmentResponseSchema])
async def list_all_segments(is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    segments = await db.segments.find().sort("created_at", -1).to_list(500)
    report_counts = await get_block_report_counts(db, [segment["_id"] for segment in segments])
    for segment in segments:
        segment["blocked_report_count"] = report_counts.get(str(segment["_id"]), 0)
        segment["id"] = str(segment["_id"])
        del segment["_id"]
    return segments


@app.get("/api/admin/segments/{segment_id}/blocked-reports")
async def list_block_reports_for_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")

    segment = await db.segments.find_one({"_id": obj_id})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    reports = await db.segment_block_reports.find({"segment_id": obj_id}).sort("reported_at", -1).to_list(200)
    return {
        "segment_id": segment_id,
        "reports_count": len(reports),
        "threshold": BLOCK_REPORT_THRESHOLD,
        "reports": [
            {
                "reported_by_strava_id": report["reported_by_strava_id"],
                "reported_at": report["reported_at"],
                "blocked_until": report.get("blocked_until")
            }
            for report in reports
        ]
    }

@app.post("/api/admin/segments/{segment_id}/approve")
async def approve_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
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

@app.patch("/api/admin/segments/{segment_id}/block")
async def block_segment(segment_id: str, data: BlockSchema = BlockSchema(), is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")
    
    update = {"blocked": True}
    if data.blocked_until:
        update["blocked_until"] = data.blocked_until
    else:
        update["blocked_until"] = None
    
    result = await db.segments.update_one(
        {"_id": obj_id},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    return {"status": "blocked"}

@app.patch("/api/admin/segments/{segment_id}/unblock")
async def unblock_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")
    
    result = await db.segments.update_one(
        {"_id": obj_id},
        {"$set": {"blocked": False, "blocked_until": None}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    return {"status": "unblocked"}

@app.delete("/api/segments/{segment_id}")
async def delete_segment(segment_id: str, is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    try:
        obj_id = ObjectId(segment_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid segment ID format")
    
    result = await db.segments.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.segment_block_reports.delete_many({"segment_id": obj_id})
    
    return {"status": "deleted"}

@app.post("/api/admin/segments/quickadd", response_model=SegmentResponseSchema, status_code=201)
async def quick_add_segment(data: QuickAddSchema, is_admin: bool = Depends(verify_admin)):
    db = db_client[MONGODB_DB_NAME]
    strava_url = data.strava_url
    
    segment_id = extract_strava_id(strava_url)
    if not segment_id:
        raise HTTPException(status_code=400, detail="Invalid Strava URL")
    
    # Check if segment already exists
    existing = await db.segments.find_one({
        "$or": [
            {"strava_id": segment_id},
            {"strava_url": {"$regex": f"segments/{segment_id}(?![0-9])"}}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Segment already exists")
    
    # Fetch details from Strava
    details = await fetch_segment_details(segment_id)
    if not details:
        raise HTTPException(status_code=400, detail="Could not fetch segment details from Strava")
    
    # Prepare segment document
    segment_dict = {
        "strava_url": strava_url,
        "strava_id": segment_id,
        "name": details.get("name"),
        "polyline": details.get("polyline"),
        "distance_km": details.get("distance_km"),
        "gradient_pct": details.get("gradient_pct"),
        "approved": True,
        "added_by_strava_id": None,
        "created_at": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    }
    
    result = await db.segments.insert_one(segment_dict)
    
    created_segment = await db.segments.find_one({"_id": result.inserted_id})
    if created_segment:
        created_segment["id"] = str(created_segment["_id"])
        del created_segment["_id"]
    return created_segment
