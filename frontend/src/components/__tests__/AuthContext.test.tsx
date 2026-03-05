import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { fetchCurrentUser } from "@/utils/api";

jest.mock("@/utils/api", () => ({
  fetchCurrentUser: jest.fn(),
}));

function Consumer() {
  const { isLoggedIn, isLoading, user, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="logged">{String(isLoggedIn)}</div>
      <div data-testid="actor">{user?.actor_id ?? ""}</div>
      <button onClick={logout}>logout</button>
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

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(screen.getByTestId("logged")).toHaveTextContent("false");
  });

  it("logout clears local auth state", async () => {
    localStorage.setItem("auth_token", "t1");
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ actor_id: "server-user", is_admin: false });
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("logged")).toHaveTextContent("true"));
    fireEvent.click(screen.getByText("logout"));
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.getByTestId("logged")).toHaveTextContent("false");
  });
});
