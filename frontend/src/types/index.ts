export type Segment = {
  id?: string;
  name: string;
  terrain: "Hilly" | "Flat";
  distance_km: number;
  gradient_pct: number;
  completion_times: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
  strava_url: string;
  approved: boolean;
  longitude?: number;
  latitude?: number;
  polyline?: string;
};
