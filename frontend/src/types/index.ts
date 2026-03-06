export type UserSummary = {
  actor_id: string;
};

export type SegmentRatingValues = {
  traffic: number;
  steady_gradient: number;
  sketchy_left_turns: number;
  downhills: number;
};

export type SegmentAverageRatings = {
  traffic: number | null;
  steady_gradient: number | null;
  sketchy_left_turns: number | null;
  downhills: number | null;
};

export type SegmentAdminReport = {
  reported_by_actor_id: string;
  reported_at: string;
  action?: "blocked" | "unblocked" | string;
  note?: string | null;
};

export type SegmentAdminRating = {
  id: string;
  segment_id: string;
  rated_by_actor_id: string;
  rated_at?: string | null;
  ratings: SegmentRatingValues;
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
  ratings_count?: number;
  average_ratings?: SegmentAverageRatings;
  reported_by_actor_ids?: string[];
  submitted_by_user?: UserSummary | null;
  reported_by_users?: UserSummary[];
  block_reports?: SegmentAdminReport[];
};
