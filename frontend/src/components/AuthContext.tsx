"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchCurrentUser, type AuthUser } from "@/utils/api";

const STRAVA_CLIENT_ID = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || "122429";

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoggedIn: false,
    isLoading: true,
    login: () => { },
    logout: () => { },
});

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
            setToken(savedToken);
            // Try to restore user from localStorage first for instant UI
            if (savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                } catch {
                    // ignore
                }
            }
            // Validate token with the server
            fetchCurrentUser(savedToken)
                .then((u) => {
                    setUser(u);
                    localStorage.setItem("auth_user", JSON.stringify(u));
                    setIsLoading(false);
                })
                .catch(() => {
                    // Token is invalid, clear everything
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
        const redirectUri = `${window.location.origin}/auth/callback`;
        const scope = "read";
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
        window.location.href = stravaAuthUrl;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoggedIn: !!user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
