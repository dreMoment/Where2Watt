import {
  fetchMySegmentReportStatus,
  fetchCurrentUser,
  reportSegmentBlocked,
  reportSegmentUnblocked,
  stravaLoginCallback,
  verifyAdminAccess,
} from "@/utils/api";
import { request } from "@/utils/apiClient";

jest.mock("@/utils/apiClient", () => ({
  API_BASE_URL: "http://localhost:8000/api",
  withBearerAuth: jest.fn((_token: string, headers: HeadersInit = {}) => new Headers(headers)),
  request: jest.fn(),
}));

describe("api utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes through backend auth contract for current user", async () => {
    (request as jest.Mock).mockResolvedValue({ actor_id: "actor-1", is_admin: true });
    const user = await fetchCurrentUser("token-1");
    expect(user).toEqual({ actor_id: "actor-1", is_admin: true });
  });

  it("calls Strava callback endpoint with expected payload", async () => {
    (request as jest.Mock).mockResolvedValue({ token: "jwt", user: { actor_id: "a1", is_admin: false } });
    await stravaLoginCallback("code-1", "http://localhost:3000/auth/callback");
    expect(request).toHaveBeenCalledWith(
      "/auth/strava/callback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "code-1", redirect_uri: "http://localhost:3000/auth/callback" }),
      })
    );
  });

  it("verifyAdminAccess returns false when request fails", async () => {
    (request as jest.Mock).mockRejectedValue(new Error("forbidden"));
    await expect(verifyAdminAccess("token-1")).resolves.toBe(false);
  });

  it("reportSegmentBlocked forwards optional note", async () => {
    (request as jest.Mock).mockResolvedValue({ status: "reported", action: "blocked", blocked: false, blocked_reports_count: 1 });
    await reportSegmentBlocked("seg-1", "token-1", "Roadworks");
    expect(request).toHaveBeenCalledWith(
      "/segments/seg-1/report-blocked",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ note: "Roadworks" }),
      })
    );
  });

  it("reportSegmentUnblocked forwards optional note", async () => {
    (request as jest.Mock).mockResolvedValue({ status: "reported", action: "unblocked", blocked: true, blocked_reports_count: 2 });
    await reportSegmentUnblocked("seg-1", "token-1", "Looks open now");
    expect(request).toHaveBeenCalledWith(
      "/segments/seg-1/report-unblocked",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ note: "Looks open now" }),
      })
    );
  });

  it("fetchMySegmentReportStatus calls expected endpoint", async () => {
    (request as jest.Mock).mockResolvedValue({ segment_id: "seg-1", expected_action: "blocked", has_reported: true });
    await fetchMySegmentReportStatus("seg-1", "token-1");
    expect(request).toHaveBeenCalledWith(
      "/segments/seg-1/my-report-status",
      expect.objectContaining({
        method: "GET",
      })
    );
  });
});
