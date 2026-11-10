import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, buildStravaAuthUrl, useAuth } from "@/components/AuthContext";
import { disconnectStrava, fetchCurrentUser } from "@/utils/api";

jest.mock("@/utils/api", () => ({
  fetchCurrentUser: jest.fn(),
  disconnectStrava: jest.fn(),
}));

function Consumer() {
  const { isLoggedIn, isLoading, user, logout, disconnect } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="logged">{String(isLoggedIn)}</div>
      <div data-testid="actor">{user?.actor_id ?? ""}</div>
      <button onClick={logout}>logout</button>
      <button onClick={() => disconnect()}>disconnect</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("restores token and user from storage then validates with backend", async () => {
    localStorage.setItem("auth_token", "t1");
    localStorage.setItem("auth_user", JSON.stringify({ actor_id: "cached", is_admin: false }));
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ actor_id: "server-user", is_admin: true });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("actor")).toHaveTextContent("cached");
    await waitFor(() => expect(screen.getByTestId("actor")).toHaveTextContent("server-user"));
    expect(localStorage.getItem("auth_user")).toContain("server-user");
    expect(screen.getByTestId("logged")).toHaveTextContent("true");
  });

  it("clears storage when saved token is invalid", async () => {
    localStorage.setItem("auth_token", "bad-token");
    localStorage.setItem("auth_user", JSON.stringify({ actor_id: "cached", is_admin: false }));
    (fetchCurrentUser as jest.Mock).mockRejectedValue(new Error("invalid"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(screen.getByTestId("logged")).toHaveTextContent("false");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("requests activity read access when starting Strava login", () => {
    const authorizeUrl = new URL(buildStravaAuthUrl("https://where2watt.example"));
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(authorizeUrl.searchParams.get("scope")).toBe("read,activity:read");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe("https://where2watt.example/auth/callback");
  });

  it("disconnect calls backend endpoint and clears auth state", async () => {
    localStorage.setItem("auth_token", "t1");
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ actor_id: "server-user", is_admin: false });
    (disconnectStrava as jest.Mock).mockResolvedValue({ status: "disconnected", deauthorized_with_strava: true, deleted: {} });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("logged")).toHaveTextContent("true"));
    fireEvent.click(screen.getByText("disconnect"));
    await waitFor(() => expect(disconnectStrava).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(screen.getByTestId("logged")).toHaveTextContent("false"));
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});
