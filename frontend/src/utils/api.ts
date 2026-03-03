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
