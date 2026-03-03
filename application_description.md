---
created: 2026-02-25
tags:
  - note
---
## 1. Executive Summary

FindMyIntervals is a highly focused, web-based map application designed to help cyclists discover and evaluate the best Strava segments for structured interval training. By relying on moderated community submissions and an upvoting system, the platform curates a high-quality database of safe, uninterrupted roads (both flat and hilly). The tool exists purely for segment discovery; users can find the perfect training grounds here, and then use their preferred software (like Komoot or RideWithGPS) to build their actual routes.

## 2. Target Audience & Core Use Cases

- **Individual Cyclists (Training):** Finding hills or flat stretches to integrate specific interval efforts into longer rides, avoiding traffic lights or unsafe intersections.
    
- **Group Ride Organizers:** Planning routes with safe, designated "drop zones" where riders can race each other up a hill before regrouping.
    
- **Local Race Directors:** Sourcing suitable, vetted segments to host grassroots time trials or local competitions.
    

## 3. Core Features & User Interface

### Web-Based Map Discovery

- **Interactive Map View:** The primary interface is a large, full-screen map populated with pins or highlighted roads showing vetted segments.
    
- **Discovery Only (No Route Building):** The platform is strictly for spotting and evaluating geographical locations to keep the user experience fast and the development scope lean.
    

### Curation & Moderated Submissions

- **Link-Based Submission Form:** Users suggest new segments by pasting a Strava segment URL into a form, along with filling out specific metadata (hazards, etc.).
    
- **Moderator Approval Queue:** To ensure high data quality and prevent spam, all user suggestions go to a hidden queue. A moderator reviews the segment for safety and accuracy before publishing it to the live map.
    
- **Community Voting:** Once live, users can upvote/downvote segments. The highest-quality, most popular local segments rise to the top of search results and map highlights.
    

### Segment Metadata & Safety Indicators

- **Terrain Categorization:** Clear tags to filter segments by "Hilly" (climbs) or "Flat" (sprints, threshold intervals).
    
- **Hazard & Intersection Warnings:** Clear indicators for cross-traffic or left turns (which disrupt intervals and pose safety risks).
    
- **Google Street View Link:** Quick access to visually inspect the segment's shoulder width and surroundings.
    

### Dynamic Strava Integration

- **Time Estimation:** Utilizing basic Strava API calls (or embedded Strava widgets) to pull in the Top 10 leaderboards. This provides an estimated completion time at high power, rather than just raw distance.
    

### Community Context
    
- **Live Status Reporting:** A feature allowing users to flag segments as "Currently Blocked" (due to roadworks or temporary hazards).