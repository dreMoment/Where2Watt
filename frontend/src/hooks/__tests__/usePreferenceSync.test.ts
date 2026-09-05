import { isRateLimitError } from "@/hooks/usePreferenceSync";
import { ApiError } from "@/utils/apiClient";

describe("isRateLimitError", () => {
  it("uses the HTTP status instead of matching human-readable messages", () => {
    expect(isRateLimitError(new ApiError("Anything", 429))).toBe(true);
    expect(isRateLimitError(new ApiError("Too many requests", 500))).toBe(false);
    expect(isRateLimitError(new Error("429 rate limit"))).toBe(false);
  });
});
