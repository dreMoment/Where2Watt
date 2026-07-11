import os

# MongoDB Connection Parameters
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME")

# Strava API Config
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")
STRAVA_API_BASE_URL = os.getenv("STRAVA_API_BASE_URL", "https://www.strava.com/api/v3")
STRAVA_WEBHOOK_VERIFY_TOKEN = os.getenv("STRAVA_WEBHOOK_VERIFY_TOKEN")
STRAVA_WEBHOOK_SECRET = os.getenv("STRAVA_WEBHOOK_SECRET")

# Auth Config
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
ACTOR_ID_SECRET = os.getenv("ACTOR_ID_SECRET", JWT_SECRET)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days

# Admin Config
ADMIN_STRAVA_IDS_RAW = os.getenv("ADMIN_STRAVA_IDS", "")
ADMIN_STRAVA_IDS: set[int] = set()
for raw_id in ADMIN_STRAVA_IDS_RAW.split(","):
    candidate = raw_id.strip()
    if not candidate:
        continue
    try:
        ADMIN_STRAVA_IDS.add(int(candidate))
    except ValueError as exc:
        raise RuntimeError("ADMIN_STRAVA_IDS must be a comma-separated list of integer Strava IDs") from exc
if not ADMIN_STRAVA_IDS:
    raise RuntimeError("ADMIN_STRAVA_IDS environment variable must include at least one Strava ID")

# Notifications
ADMIN_DISCORD_WEBHOOK_URL = os.getenv("ADMIN_DISCORD_WEBHOOK_URL")

# CORS Config
CORS_ORIGIN = os.getenv("CORS_ORIGIN")
if not CORS_ORIGIN:
    raise RuntimeError("CORS_ORIGIN environment variable must be set")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGIN.split(",")]
