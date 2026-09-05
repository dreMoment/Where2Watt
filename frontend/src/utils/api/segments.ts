import type { Segment, SegmentAverageRatings, SegmentRatingValues } from "@/types";
import { request, withBearerAuth } from "@/utils/apiClient";

export interface SubmissionData {
  strava_url: string;
  safety_notes: string;
  ratings: SegmentRatingValues;
}

export interface SegmentSubmitResponse extends Segment {
  status: "created" | "existing";
  duplicate_reason: "already_in_database" | "under_review" | "similar_segment" | null;
  rating_status: "added" | "updated";
}

export interface StarredStravaSegment {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_m: number | null;
}

interface StravaSegmentPreviewResponse {
  id: string;
  name: string;
  strava_url: string;
  polyline: string;
  distance_km: number;
  gradient_pct: number;
}

export interface ReportBlockedResponse {
  status: "reported" | "already_reported";
  action: "blocked" | "unblocked";
  blocked: boolean;
}

export interface RateSegmentResponse {
  status: "rated" | "deleted";
  ratings_count: number;
  average_ratings: SegmentAverageRatings;
}

export interface MySegmentRatingStatusResponse {
  segment_id: string;
  has_rated: boolean;
  rating?: SegmentRatingValues | null;
  rated_at?: string | null;
}

export interface MySegmentReportStatusResponse {
  segment_id: string;
  expected_action: "blocked" | "unblocked";
  has_reported: boolean;
  report?: {
    action?: "blocked" | "unblocked";
    reported_at?: string;
    note?: string | null;
  } | null;
}

export function fetchSegments(): Promise<Segment[]> {
  return request("/segments", { method: "GET", errorMessage: "Could not load segments" });
}

export function submitSegment(data: SubmissionData, token: string): Promise<SegmentSubmitResponse> {
  return request("/segments", {
    method: "POST",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
    errorMessage: "Failed to submit segment",
  });
}

export function fetchStarredStravaSegments(token: string): Promise<StarredStravaSegment[]> {
  return request("/strava/segments/starred?per_page=100", {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Could not load your starred Strava segments",
  });
}

export async function fetchStravaSegmentPreview(id: string, token: string): Promise<Segment> {
  const segment = await request<StravaSegmentPreviewResponse>(`/strava/segments/${id}/preview`, {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Could not load segment preview",
  });
  return {
    ...segment,
    strava_id: segment.id,
    approved: false,
    completion_times: { beginner: "", intermediate: "", advanced: "" },
  };
}

function reportSegmentState(
  id: string,
  token: string,
  action: "blocked" | "unblocked",
  note?: string
): Promise<ReportBlockedResponse> {
  return request(`/segments/${id}/report-${action}`, {
    method: "POST",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(note ? { note } : {}),
    errorMessage: `Failed to report segment as ${action}`,
  });
}

export function reportSegmentBlocked(id: string, token: string, note?: string): Promise<ReportBlockedResponse> {
  return reportSegmentState(id, token, "blocked", note);
}

export function reportSegmentUnblocked(id: string, token: string, note?: string): Promise<ReportBlockedResponse> {
  return reportSegmentState(id, token, "unblocked", note);
}

export function fetchMySegmentReportStatus(id: string, token: string): Promise<MySegmentReportStatusResponse> {
  return request(`/segments/${id}/my-report-status`, {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch report status",
  });
}

export function rateSegment(id: string, token: string, ratings: SegmentRatingValues): Promise<RateSegmentResponse> {
  return request(`/segments/${id}/ratings`, {
    method: "POST",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(ratings),
    errorMessage: "Failed to submit rating",
  });
}

export function deleteMySegmentRating(id: string, token: string): Promise<RateSegmentResponse> {
  return request(`/segments/${id}/ratings`, {
    method: "DELETE",
    headers: withBearerAuth(token),
    errorMessage: "Failed to delete rating",
  });
}

export function fetchMySegmentRatingStatus(id: string, token: string): Promise<MySegmentRatingStatusResponse> {
  return request(`/segments/${id}/my-rating-status`, {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch rating status",
  });
}
