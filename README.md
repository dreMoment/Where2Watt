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

You need Docker with Compose, Node.js 20.9 or newer, npm, and (for login) a
[Strava API app](https://www.strava.com/settings/api).

### First-time setup

```bash
make setup
```

The command installs the frontend dependencies and creates local environment
files from the committed examples (without overwriting existing files).

Start the backend and database:

```bash
make backend
```

In another terminal, start the frontend:

```bash
make frontend
```

Open http://localhost:3000. The API health endpoint is available at
http://localhost:8080/health.

Stop the backend and database with:

```bash
make down
```

The Makefile automatically uses passwordless `sudo` when the current account
cannot access the Docker socket directly. If neither works, add your account to
the Docker group and sign in again, or pass an appropriate command with the
`DOCKER` override.

### Strava authentication

The app and health endpoint work without real Strava credentials, but login and
segment imports require a Strava API application. Update these values in
`backend/.env`:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN` (needed for app-level Strava requests)
- `ADMIN_STRAVA_IDS` (your numeric Strava athlete ID)

Set the same client ID as `NEXT_PUBLIC_STRAVA_CLIENT_ID` in
`frontend/.env.local`. Configure `http://localhost:3000/auth/callback` as the
local OAuth callback in the Strava application.

Restart both development servers after changing environment variables.

## Tests

```bash
make test
```

Backend integration tests use a disposable MongoDB container. To run only the
frontend checks, use `make test-frontend`; for the backend, use
`make test-backend`.

## License

[MIT](LICENSE)
