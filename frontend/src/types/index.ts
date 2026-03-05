export type UserSummary = {
  actor_id: string;
};

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
  submitted_by_actor_id?: string;
  blocked?: boolean;
  blocked_until?: string;
  blocked_report_count?: number;
  reported_by_actor_ids?: string[];
  submitted_by_user?: UserSummary | null;
  reported_by_users?: UserSummary[];
};
