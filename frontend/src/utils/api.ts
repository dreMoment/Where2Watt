import type { Segment } from "@/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export async function fetchSegments(): Promise<Segment[]> {
    const res = await fetch(`${API_BASE_URL}/segments`);
    if (!res.ok) {
        throw new Error("Network response was not ok");
    }
    return res.json();
}

export interface SubmissionData {
    strava_url: string;
    safety_notes: string;
}

export async function submitSegment(data: SubmissionData): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        let errorMessage = "Failed to submit segment";
        try {
            const errorData = await res.json();
            if (errorData.detail) {
                errorMessage = errorData.detail;
            }
        } catch {
            // ignore JSON parse error
        }
        throw new Error(errorMessage);
    }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
    const res = await fetch(`${API_BASE_URL}/admin/verify`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-password": password
        }
    });
    return res.ok;
}

export async function deleteSegment(id: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/segments/${id}`, {
        method: "DELETE",
        headers: {
            "x-admin-password": password
        }
    });
    if (!res.ok) {
        throw new Error("Failed to delete segment");
    }
}

export async function fetchUnapprovedSegments(password: string): Promise<Segment[]> {
    const res = await fetch(`${API_BASE_URL}/admin/segments/unapproved`, {
        headers: {
            "x-admin-password": password
        }
    });
    if (!res.ok) {
        throw new Error("Failed to fetch unapproved segments");
    }
    return res.json();
}

export async function fetchAllSegments(password: string): Promise<Segment[]> {
    const res = await fetch(`${API_BASE_URL}/admin/segments`, {
        headers: {
            "x-admin-password": password
        }
    });
    if (!res.ok) {
        throw new Error("Failed to fetch all segments");
    }
    return res.json();
}

export async function approveSegment(id: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/admin/segments/${id}/approve`, {
        method: "POST",
        headers: {
            "x-admin-password": password
        }
    });
    if (!res.ok) {
        throw new Error("Failed to approve segment");
    }
}

export async function quickAddSegment(stravaUrl: string, password: string): Promise<Segment> {
    const res = await fetch(`${API_BASE_URL}/admin/segments/quickadd`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-password": password
        },
        body: JSON.stringify({ strava_url: stravaUrl }),
    });

    if (!res.ok) {
        let errorMessage = "Failed to quickadd segment";
        try {
            const errorData = await res.json();
            if (errorData.detail) {
                errorMessage = errorData.detail;
            }
        } catch {
            // ignore JSON parse error
        }
        throw new Error(errorMessage);
    }
    return res.json();
}
