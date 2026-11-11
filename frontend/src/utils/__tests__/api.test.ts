import {
  reportSegmentBlocked,
  reportSegmentUnblocked,
  stravaLoginCallback,
  verifyAdminAccess,
} from "@/utils/api";
import { request } from "@/utils/apiClient";

jest.mock("@/utils/apiClient", () => ({
  API_BASE_URL: "/api",
  withBearerAuth: jest.fn((_token: string, headers: HeadersInit = {}) => new Headers(headers)),
  request: jest.fn(),
}));

describe("api utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it.each([
    ["blocked", reportSegmentBlocked, "Roadworks"],
    ["unblocked", reportSegmentUnblocked, "Looks open now"],
  ] as const)("reportSegment %s forwards optional note", async (action, report, note) => {
    (request as jest.Mock).mockResolvedValue({ status: "reported", action, blocked: action !== "blocked" });
    await report("seg-1", "token-1", note);
    expect(request).toHaveBeenCalledWith(
      `/segments/seg-1/report-${action}`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ note }),
      })
    );
  });
});
