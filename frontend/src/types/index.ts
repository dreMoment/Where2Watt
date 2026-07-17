export type UserSummary = {
  actor_id: string;
};

export type SegmentRatingValues = {
  overall_quality: number;
  traffic_level: number;
  road_surface: number;
  gradient_profile: number;
  sketchy_left_turns: number;
};

export type SegmentAverageRatings = {
  overall_quality: number | null;
  traffic_level: number | null;
  road_surface: number | null;
  gradient_profile: number | null;
  sketchy_left_turns: number | null;
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
  blocked?: boolean;
  block_message?: string | null;
  aliases?: string[];
  ratings_count?: number;
  average_ratings?: SegmentAverageRatings;
  reported_by_actor_ids?: string[];
  reported_by_users?: UserSummary[];
  block_reports?: SegmentAdminReport[];
};

export type ExploreCandidate = {
  id: string;
  strava_url: string;
  name: string;
  distance_km: number;
  elevation_difference_m: number;
  average_grade_pct: number;
  climb_category: number;
  climb_category_description?: string | null;
  coordinates: [number, number][];
};
