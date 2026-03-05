export type UserSummary = {
  actor_id: string;
};

export type SegmentAdminReport = {
  reported_by_actor_id: string;
  reported_at: string;
  action?: "blocked" | "unblocked" | string;
  note?: string | null;
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
  blocked_report_count?: number;
  reported_by_actor_ids?: string[];
  submitted_by_user?: UserSummary | null;
  reported_by_users?: UserSummary[];
  block_reports?: SegmentAdminReport[];
};
