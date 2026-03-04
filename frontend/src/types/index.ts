export type Segment = {
  id?: string;
  name: string;
  distance_km: number;
  gradient_pct: number;
  completion_times: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
  strava_url: string;
  strava_id?: string;
  approved: boolean;
  polyline?: string;
  created_at?: string;
  blocked?: boolean;
  blocked_until?: string;
};
