# Where2Watt

A map of road segments that are good for cycling intervals: long, safe, and without traffic lights or awkward junctions.

Live at **[where2watt.cc](https://where2watt.cc)**.

Find a flat stretch or a climb near you, check its distance, gradient and elevation profile, then plan your ride in Komoot, RideWithGPS or whatever you use. Where2Watt only helps you find the segments. It doesn't build routes.

## Features

- Full-screen map of curated segments, filterable by terrain (flat or hilly)
- Segment cards with distance, gradient, elevation profile and estimated times
- Sign in with Strava to submit segments by URL, rate them, and see community ratings
- Admin dashboard to review, approve and merge submissions

## Stack

| Part | Tech |
| --- | --- |
| Frontend | Next.js, React, Tailwind, MapLibre (`frontend/`) |
| Backend | FastAPI, Motor (MongoDB) (`backend/`) |
| Data | MongoDB, Strava API |
| Hosting | Vercel (frontend), Google Cloud Run (backend) |

## Running locally

You need Docker, Node.js and a [Strava API app](https://www.strava.com/settings/api).

**Backend:** create `backend/.env` with:

```env
MONGODB_URI=mongodb://mongodb:27017
MONGODB_DB_NAME=where2watt
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
JWT_SECRET=any-long-random-string
ADMIN_STRAVA_IDS=your-strava-athlete-id
CORS_ORIGIN=http://localhost:3000
```

Then:

```bash
cd backend
docker compose up --build   # API on http://localhost:8080
```

**Frontend:**

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api \
NEXT_PUBLIC_STRAVA_CLIENT_ID=... \
npm run dev                 # http://localhost:3000
```

## Tests

```bash
cd backend && docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
cd frontend && npm test
```
