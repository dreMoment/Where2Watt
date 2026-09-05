import type { Segment, SegmentAdminRating, SegmentAverageRatings } from "@/types";
import { request, withBearerAuth } from "@/utils/apiClient";

export interface AdminDeleteSegmentRatingResponse {
  status: "deleted";
  ratings_count: number;
  average_ratings: SegmentAverageRatings;
}

export interface AdminMergeSegmentResponse {
  status: "merged";
  merged_from_segment_id: string;
  merged_into_segment_id: string;
  moved_ratings: number;
  aliases: string[];
}

export interface AdminSplitSegmentResponse {
  status: "split";
  source_segment_id: string;
  created_segments: Segment[];
  skipped_aliases: string[];
}

export async function verifyAdminAccess(token: string): Promise<boolean> {
  try {
    await request("/admin/verify", {
      method: "POST",
      headers: withBearerAuth(token),
      errorMessage: "Admin access required",
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteSegment(id: string, token: string): Promise<void> {
  await request(`/segments/${id}`, {
    method: "DELETE",
    headers: withBearerAuth(token),
    errorMessage: "Failed to delete segment",
  });
}

export function fetchUnapprovedSegments(token: string): Promise<Segment[]> {
  return request("/admin/segments/unapproved", {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch unapproved segments",
  });
}

export function fetchAllSegments(token: string): Promise<Segment[]> {
  return request("/admin/segments", {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch all segments",
  });
}

export function fetchAdminSegmentRatings(id: string, token: string): Promise<SegmentAdminRating[]> {
  return request(`/admin/segments/${id}/ratings`, {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch segment ratings",
  });
}

export async function approveSegment(id: string, token: string): Promise<void> {
  await request(`/admin/segments/${id}/approve`, {
    method: "POST",
    headers: withBearerAuth(token),
    errorMessage: "Failed to approve segment",
  });
}

export function deleteAdminSegmentRating(
  segmentId: string,
  ratingId: string,
  token: string
): Promise<AdminDeleteSegmentRatingResponse> {
  return request(`/admin/segments/${segmentId}/ratings/${ratingId}`, {
    method: "DELETE",
    headers: withBearerAuth(token),
    errorMessage: "Failed to delete rating",
  });
}

export function quickAddSegment(stravaUrl: string, token: string): Promise<Segment> {
  return request("/admin/segments/quickadd", {
    method: "POST",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ strava_url: stravaUrl }),
    errorMessage: "Failed to quickadd segment",
  });
}

export async function blockSegment(id: string, token: string, message?: string): Promise<void> {
  const trimmed = message?.trim();
  await request(`/admin/segments/${id}/block`, {
    method: "PATCH",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(trimmed ? { message: trimmed } : {}),
    errorMessage: "Failed to block segment",
  });
}

export async function unblockSegment(id: string, token: string): Promise<void> {
  await request(`/admin/segments/${id}/unblock`, {
    method: "PATCH",
    headers: withBearerAuth(token),
    errorMessage: "Failed to unblock segment",
  });
}

export function mergeSegment(
  sourceSegmentId: string,
  targetSegmentId: string,
  token: string
): Promise<AdminMergeSegmentResponse> {
  return request(`/admin/segments/${sourceSegmentId}/merge`, {
    method: "POST",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ target_segment_id: targetSegmentId }),
    errorMessage: "Failed to merge segment",
  });
}

export function splitSegment(id: string, token: string): Promise<AdminSplitSegmentResponse> {
  return request(`/admin/segments/${id}/split`, {
    method: "POST",
    headers: withBearerAuth(token),
    errorMessage: "Failed to split segment",
  });
}
