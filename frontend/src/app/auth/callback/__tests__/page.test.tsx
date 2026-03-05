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

  it("shows missing-code error when callback query has no code", async () => {
    render(<AuthCallbackPage />);
    await waitFor(() => expect(screen.getByText("Login Failed")).toBeInTheDocument());
    expect(screen.getByText("Missing authorization code.")).toBeInTheDocument();
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

  it("shows backend-auth failure message when callback request fails", async () => {
    window.history.replaceState({}, "", "/auth/callback?code=abc");
    (stravaLoginCallback as jest.Mock).mockRejectedValue(new Error("boom"));

    render(<AuthCallbackPage />);
    await waitFor(() => expect(screen.getByText("Login Failed")).toBeInTheDocument());
    expect(screen.getByText("Failed to complete authentication. Please try again.")).toBeInTheDocument();
  });
});
