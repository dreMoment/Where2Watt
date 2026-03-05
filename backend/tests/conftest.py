import os
import uuid

# Ensure required settings are available before importing app modules.
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-with-at-least-32-bytes")
os.environ.setdefault("ADMIN_STRAVA_IDS", "987654")
os.environ.setdefault("CORS_ORIGIN", "http://localhost:3000")
os.environ.setdefault(
    "MONGODB_URI",
    "mongodb://user:password@localhost:27017/?authSource=admin",
)
os.environ.setdefault("MONGODB_DB_NAME", "findmyintervals_test")
os.environ.setdefault("STRAVA_CLIENT_ID", "test-client-id")
os.environ.setdefault("STRAVA_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("STRAVA_REFRESH_TOKEN", "test-refresh-token")

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient


@pytest.fixture(scope="session")
def app_client():
    from main import app

    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def mongo_client():
    client = MongoClient(os.environ["MONGODB_URI"])
    yield client
    client.close()


@pytest.fixture(scope="session")
def test_db_name():
    return os.environ["MONGODB_DB_NAME"]


@pytest.fixture(autouse=True)
def cleanup_test_db(request):
    # Only integration tests should touch MongoDB.
    if "integration" not in request.keywords:
        yield
        return

    client = MongoClient(os.environ["MONGODB_URI"])
    db_name = os.environ["MONGODB_DB_NAME"]
    client.drop_database(db_name)
    yield
    client.drop_database(db_name)
    client.close()
