import os

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
if not CORS_ORIGIN:
    raise RuntimeError("CORS_ORIGIN environment variable must be set")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGIN.split(",")]
