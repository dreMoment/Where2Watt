# Where2Watt - Minimum Viable Product (MVP)

## 1. Objective of the MVP
The goal of the MVP is to validate the core concept: cyclists need a curated map to quickly discover safe, uninterrupted road segments for structured interval training. The MVP focuses purely on **discovery** and **basic community submission**, stripping away complex API integrations and social features to ensure rapid development and deployment.

## 2. Core Value Proposition
A fast, simple web map displaying high-quality, pre-vetted training segments, categorized by terrain (Flat/Hilly), allowing cyclists to figure out exactly where to execute their intervals before building their route elsewhere.

## 3. MVP Feature Set

### 3.1. Interactive Map Discovery (The Core Experience)
- **Map Interface:** A full-screen map (e.g., using Mapbox, Leaflet, or Google Maps) displaying pins or simple highlighted paths for available segments.
- **Segment Details Card:** Clicking a map pin reveals essential details:
  - Segment Name
  - Terrain Type (Hilly or Flat)
  - Distance & Average Gradient (manually entered for the MVP)
  - Estimated Completion Time (displayed for 3 athlete levels: Beginner, Intermediate, Advanced)
  - A direct external link to the segment on Strava
- **Basic Filtering:** A simple toggle so users can filter the map view by "Hilly" or "Flat" segments.

### 3.2. Simple Segment Submission
- **Submission Form:** A straightforward public form where users can contribute:
  - Strava Segment URL
  - Terrain Type (Hilly/Flat)
  - A free-text field for safety notes / hazard warnings.
- **Manual Curation:** Submissions are stored in a simple database. Instead of a complex moderator queue UI, the admin manually reviews new DB entries, verifies them via Strava, and toggles an "approved" flag to make them live on the map.

## 4. Features Excluded from MVP (Deferred to V2)
To keep the MVP scope lean, the following features are deliberately omitted:
- **Community Voting System:** No upvote/downvote mechanics. Curation relies purely on the admin for the initial dataset.
- **Dynamic Strava API Integration:** Pulling live leaderboards and dynamic segment path rendering are excluded. We will just link out to Strava instead.
- **User Authentication:** Users do not need an account or to log in via Strava to view the map or submit a simple segment link.
- **Live Status Reporting:** Flagging segments as temporarily blocked or having roadworks.
- **Google Street View Embeds:** Excluded to save on API complexity (users can use the Strava link to investigate further if needed).

## 5. Suggested Tech Stack
- **Frontend:** React or Next.js with a map library like `react-leaflet`.
- **Backend:** Python
- **Database:** MongoDB (running locally for the time being) to store segments and submissions.
- **Hosting:** Vercel or Netlify for the frontend; backend can be self-hosted or run locally during development.
- **Styling:** Tailwind CSS for rapid UI development.
