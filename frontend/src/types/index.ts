export type UserSummary = {
  strava_id: number;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
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
  submitted_by_strava_id?: number;
  blocked?: boolean;
  blocked_until?: string;
  blocked_report_count?: number;
  reported_by_strava_ids?: number[];
  submitted_by_user?: UserSummary | null;
  reported_by_users?: UserSummary[];
};
