import type { Segment, SegmentAdminRating, SegmentAverageRatings, SegmentRatingValues } from "@/types";
import { request, withBearerAuth } from "@/utils/apiClient";
export { API_BASE_URL } from "@/utils/apiClient";

export interface AuthUser {
    actor_id: string;
    is_admin: boolean;
    strava_id?: number;
    username?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    profile_pic?: string | null;
}

export async function stravaLoginCallback(code: string, redirectUri: string): Promise<{ token: string; user: AuthUser }> {
    return request<{ token: string; user: AuthUser }>("/auth/strava/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
        errorMessage: "Failed to authenticate with Strava",
    });
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
    return request<AuthUser>("/auth/me", {
        headers: { "Authorization": `Bearer ${token}` },
        errorMessage: "Failed to fetch user",
    });
}

export async function fetchSegments(): Promise<Segment[]> {
    return request<Segment[]>("/segments", {
        errorMessage: "Network response was not ok",
    });
}

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

export async function submitSegment(data: SubmissionData, token: string): Promise<SegmentSubmitResponse> {
    return request<SegmentSubmitResponse>("/segments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        errorMessage: "Failed to submit segment",
    });
}

export interface StarredStravaSegment {
    id: string;
    name: string;
    distance_km: number | null;
    elevation_m: number | null;
}

export async function fetchStarredStravaSegments(token: string): Promise<StarredStravaSegment[]> {
    return request<StarredStravaSegment[]>("/strava/segments/starred?per_page=100", {
        headers: withBearerAuth(token),
        errorMessage: "Could not load your starred Strava segments",
    });
}

type StravaSegmentPreviewResponse = {
    id: string;
    name: string;
    strava_url: string;
    polyline: string;
    distance_km: number;
    gradient_pct: number;
};

export async function fetchStravaSegmentPreview(id: string, token: string): Promise<Segment> {
    const segment = await request<StravaSegmentPreviewResponse>(`/strava/segments/${id}/preview`, {
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

export async function verifyAdminAccess(token: string): Promise<boolean> {
    try {
        await request("/admin/verify", {
            method: "POST",
            headers: withBearerAuth(token, { "Content-Type": "application/json" }),
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

export async function fetchUnapprovedSegments(token: string): Promise<Segment[]> {
    return request<Segment[]>("/admin/segments/unapproved", {
        headers: withBearerAuth(token),
        errorMessage: "Failed to fetch unapproved segments",
    });
}

export async function fetchAllSegments(token: string): Promise<Segment[]> {
    return request<Segment[]>("/admin/segments", {
        headers: withBearerAuth(token),
        errorMessage: "Failed to fetch all segments",
    });
}

export async function fetchAdminSegmentRatings(id: string, token: string): Promise<SegmentAdminRating[]> {
    return request<SegmentAdminRating[]>(`/admin/segments/${id}/ratings`, {
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

export interface AdminDeleteSegmentRatingResponse {
    status: "deleted";
    ratings_count: number;
    average_ratings: SegmentAverageRatings;
}

export async function deleteAdminSegmentRating(
    segmentId: string,
    ratingId: string,
    token: string
): Promise<AdminDeleteSegmentRatingResponse> {
    return request<AdminDeleteSegmentRatingResponse>(`/admin/segments/${segmentId}/ratings/${ratingId}`, {
        method: "DELETE",
        headers: withBearerAuth(token),
        errorMessage: "Failed to delete rating",
    });
}

export async function quickAddSegment(stravaUrl: string, token: string): Promise<Segment> {
    return request<Segment>("/admin/segments/quickadd", {
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

export interface AdminMergeSegmentResponse {
    status: "merged";
    merged_from_segment_id: string;
    merged_into_segment_id: string;
    moved_ratings: number;
    aliases: string[];
}

export async function mergeSegment(sourceSegmentId: string, targetSegmentId: string, token: string): Promise<AdminMergeSegmentResponse> {
    return request<AdminMergeSegmentResponse>(`/admin/segments/${sourceSegmentId}/merge`, {
        method: "POST",
        headers: withBearerAuth(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ target_segment_id: targetSegmentId }),
        errorMessage: "Failed to merge segment",
    });
}

export interface AdminSplitSegmentResponse {
    status: "split";
    source_segment_id: string;
    created_segments: Segment[];
    skipped_aliases: string[];
}

export async function splitSegment(id: string, token: string): Promise<AdminSplitSegmentResponse> {
    return request<AdminSplitSegmentResponse>(`/admin/segments/${id}/split`, {
        method: "POST",
        headers: withBearerAuth(token),
        errorMessage: "Failed to split segment",
    });
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

export interface DisconnectResponse {
    status: "disconnected";
    deauthorized_with_strava: boolean;
    deleted: Record<string, number>;
}

export interface UserPreferencesResponse {
    hide_info_screen: boolean;
    rider_weight_kg: number;
    bike_weight_kg: number;
    interval_filter_power_watts: number;
    interval_filter_minutes: number;
}

export type UserPreferencesUpdateRequest = Partial<UserPreferencesResponse>;

export async function disconnectStrava(token: string): Promise<DisconnectResponse> {
    return request<DisconnectResponse>("/auth/disconnect", {
        method: "POST",
        headers: withBearerAuth(token),
        errorMessage: "Failed to disconnect Strava",
    });
}

export async function fetchUserPreferences(token: string): Promise<UserPreferencesResponse> {
    return request<UserPreferencesResponse>("/auth/preferences", {
        method: "GET",
        headers: withBearerAuth(token),
        errorMessage: "Failed to fetch user preferences",
    });
}

export async function updateUserPreferences(
    token: string,
    preferences: UserPreferencesUpdateRequest
): Promise<UserPreferencesResponse> {
    return request<UserPreferencesResponse>("/auth/preferences", {
        method: "PATCH",
        headers: withBearerAuth(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(preferences),
        errorMessage: "Failed to update user preferences",
    });
}

export async function reportSegmentBlocked(id: string, token: string, note?: string): Promise<ReportBlockedResponse> {
    const body: Record<string, string> = {};
    if (note) {
        body.note = note;
    }
    return request<ReportBlockedResponse>(`/segments/${id}/report-blocked`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        errorMessage: "Failed to report segment as blocked",
    });
}

export async function reportSegmentUnblocked(id: string, token: string, note?: string): Promise<ReportBlockedResponse> {
    const body: Record<string, string> = {};
    if (note) {
        body.note = note;
    }
    return request<ReportBlockedResponse>(`/segments/${id}/report-unblocked`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        errorMessage: "Failed to report segment as unblocked",
    });
}

export async function fetchMySegmentReportStatus(id: string, token: string): Promise<MySegmentReportStatusResponse> {
    return request<MySegmentReportStatusResponse>(`/segments/${id}/my-report-status`, {
        method: "GET",
        headers: withBearerAuth(token),
        errorMessage: "Failed to fetch report status",
    });
}

export async function rateSegment(id: string, token: string, ratings: SegmentRatingValues): Promise<RateSegmentResponse> {
    return request<RateSegmentResponse>(`/segments/${id}/ratings`, {
        method: "POST",
        headers: withBearerAuth(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(ratings),
        errorMessage: "Failed to submit rating",
    });
}

export async function deleteMySegmentRating(id: string, token: string): Promise<RateSegmentResponse> {
    return request<RateSegmentResponse>(`/segments/${id}/ratings`, {
        method: "DELETE",
        headers: withBearerAuth(token),
        errorMessage: "Failed to delete rating",
    });
}

export async function fetchMySegmentRatingStatus(id: string, token: string): Promise<MySegmentRatingStatusResponse> {
    return request<MySegmentRatingStatusResponse>(`/segments/${id}/my-rating-status`, {
        method: "GET",
        headers: withBearerAuth(token),
        errorMessage: "Failed to fetch rating status",
    });
}
