import { request, withBearerAuth } from "@/utils/apiClient";

export interface AuthUser {
  actor_id: string;
  is_admin: boolean;
}

export interface DisconnectResponse {
  status: "disconnected";
  deauthorized_with_strava: boolean;
  deleted: Record<string, number>;
}

export interface UserPreferencesResponse {
  hide_info_screen: boolean;
  rider_weight_kg: number;
  bike_weight_kg: number;
  interval_filter_power_watts: number;
  interval_filter_minutes: number;
}

export type UserPreferencesUpdateRequest = Partial<UserPreferencesResponse>;

export function stravaLoginCallback(code: string, redirectUri: string): Promise<{ token: string; user: AuthUser }> {
  return request("/auth/strava/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
    errorMessage: "Failed to authenticate with Strava",
  });
}

export function fetchCurrentUser(token: string): Promise<AuthUser> {
  return request("/auth/me", {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch user",
  });
}

export function disconnectStrava(token: string): Promise<DisconnectResponse> {
  return request("/auth/disconnect", {
    method: "POST",
    headers: withBearerAuth(token),
    errorMessage: "Failed to disconnect Strava",
  });
}

export function fetchUserPreferences(token: string): Promise<UserPreferencesResponse> {
  return request("/auth/preferences", {
    method: "GET",
    headers: withBearerAuth(token),
    errorMessage: "Failed to fetch user preferences",
  });
}

export function updateUserPreferences(
  token: string,
  preferences: UserPreferencesUpdateRequest
): Promise<UserPreferencesResponse> {
  return request("/auth/preferences", {
    method: "PATCH",
    headers: withBearerAuth(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(preferences),
    errorMessage: "Failed to update user preferences",
  });
}
