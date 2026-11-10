import { render, screen, waitFor } from "@testing-library/react";
import AuthCallbackPage from "@/app/auth/callback/page";
import { stravaLoginCallback } from "@/utils/api";

jest.mock("@/utils/api", () => ({
  stravaLoginCallback: jest.fn(),
}));

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
    window.history.replaceState({}, "", "/auth/callback");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ["no code in the query", "/auth/callback", "Missing authorization code."],
    ["the backend request fails", "/auth/callback?code=abc", "Failed to complete authentication. Please try again."],
  ])("shows an error when %s", async (_case, url, message) => {
    window.history.replaceState({}, "", url);
    (stravaLoginCallback as jest.Mock).mockRejectedValue(new Error("boom"));

    render(<AuthCallbackPage />);
    await waitFor(() => expect(screen.getByText("Login Failed")).toBeInTheDocument());
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("stores auth data and redirects on successful callback", async () => {
    window.history.replaceState({}, "", "/auth/callback?code=abc");
    (stravaLoginCallback as jest.Mock).mockResolvedValue({
      token: "token-1",
      user: { actor_id: "actor-1", is_admin: false },
    });

    render(<AuthCallbackPage />);
    await waitFor(() => expect(screen.getByText("You're In!")).toBeInTheDocument());
    expect(localStorage.getItem("auth_token")).toBe("token-1");
    expect(localStorage.getItem("auth_user")).toContain("actor-1");
  });
});
