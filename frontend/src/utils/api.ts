import type { Segment } from "@/types";
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
}

export async function submitSegment(data: SubmissionData, token: string): Promise<void> {
    await request("/segments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        errorMessage: "Failed to submit segment",
    });
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

export async function approveSegment(id: string, token: string): Promise<void> {
    await request(`/admin/segments/${id}/approve`, {
        method: "POST",
        headers: withBearerAuth(token),
        errorMessage: "Failed to approve segment",
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

export async function blockSegment(id: string, token: string): Promise<void> {
    await request(`/admin/segments/${id}/block`, {
        method: "PATCH",
        headers: withBearerAuth(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({}),
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

export interface ReportBlockedResponse {
    status: "reported" | "already_reported";
    action: "blocked" | "unblocked";
    blocked: boolean;
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
