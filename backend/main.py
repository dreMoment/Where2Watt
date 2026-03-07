from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import CORS_ORIGINS
from database import get_db, lifespan
from rate_limiter import limiter
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.segments import router as segments_router

app = FastAPI(
    lifespan=lifespan,
    title="Where2Watt API",
    docs_url=None,      # disables Swagger UI (/docs)
    redoc_url=None,     # disables ReDoc (/redoc)
    openapi_url=None,   # disables OpenAPI JSON (/openapi.json)
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    try:
        db = get_db()
        await db.client.admin.command("ping")
        return {"status": "ok", "db_connected": True}
    except Exception:
        return {"status": "error", "db_connected": False}


app.include_router(auth_router)
app.include_router(segments_router)
app.include_router(admin_router)
