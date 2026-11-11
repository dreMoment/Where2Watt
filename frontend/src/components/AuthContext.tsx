"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { disconnectStrava, fetchCurrentUser, type AuthUser, type DisconnectResponse } from "@/utils/api";

const STRAVA_CLIENT_ID = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || "122429";

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: () => void;
    logout: () => void;
    disconnect: () => Promise<DisconnectResponse | null>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoggedIn: false,
    isLoading: true,
    login: () => { },
    logout: () => { },
    disconnect: async () => null,
});

export function buildStravaAuthUrl(origin: string): string {
    const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        redirect_uri: `${origin}/auth/callback`,
        response_type: "code",
        // Required to resolve activity segment-effort URLs owned by the athlete.
        scope: "read,activity:read",
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // On mount, check for existing token and validate it
    useEffect(() => {
        const savedToken = localStorage.getItem("auth_token");
        const savedUser = localStorage.getItem("auth_user");

        if (savedToken) {
            // The cached identity is intentionally restored in the same effect pass
            // so returning users do not see a logged-out flash.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setToken(savedToken);
            if (savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                } catch {
                    // ignore
                }
            }
            fetchCurrentUser(savedToken)
                .then((u) => {
                    setUser(u);
                    localStorage.setItem("auth_user", JSON.stringify(u));
                    setIsLoading(false);
                })
                .catch((error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const debugPayload = {
                        reason: "auth-bootstrap-validation-failed",
                        error: errorMessage,
                        origin: window.location.origin,
                        timestamp: new Date().toISOString(),
                    };
                    sessionStorage.setItem("auth_debug_last_failure", JSON.stringify(debugPayload));
                    console.warn("[auth] Clearing local auth after /auth/me validation failure", debugPayload);
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("auth_user");
                    setToken(null);
                    setUser(null);
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(() => {
        window.location.href = buildStravaAuthUrl(window.location.origin);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
    }, []);

    const disconnect = useCallback(async () => {
        if (!token) {
            logout();
            return null;
        }
        const response = await disconnectStrava(token);
        logout();
        return response;
    }, [logout, token]);

    return (
        <AuthContext.Provider value={{ user, token, isLoggedIn: !!user, isLoading, login, logout, disconnect }}>
            {children}
        </AuthContext.Provider>
    );
}
