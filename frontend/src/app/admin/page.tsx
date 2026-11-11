"use client";

import { useEffect, useState } from "react";
import AdminDashboard from "@/components/AdminDashboard";
import { useAuth } from "@/components/AuthContext";
import StravaConnectButton from "@/components/StravaConnectButton";
import { verifyAdminAccess } from "@/utils/api";

export default function AdminPage() {
    const { isLoading, isLoggedIn, login, logout, token } = useAuth();
    const [adminCheck, setAdminCheck] = useState<{ token: string; isAdmin: boolean } | null>(null);

    useEffect(() => {
        if (!token) return;

        let cancelled = false;
        verifyAdminAccess(token)
            .then((isAdmin) => {
                if (!cancelled) setAdminCheck({ token, isAdmin });
            })
            .catch(() => {
                if (!cancelled) setAdminCheck({ token, isAdmin: false });
            });

        return () => {
            cancelled = true;
        };
    }, [token]);

    const isAdmin = adminCheck?.token === token ? adminCheck.isAdmin : null;

    if (isLoading) return null;

    if (!isLoggedIn || !token) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                    <h1 className="text-2xl font-bold mb-3">Admin Access</h1>
                    <p className="text-gray-400 mb-6">You must log in with Strava to continue.</p>
                    <div className="flex justify-center">
                        <StravaConnectButton onClick={login} />
                    </div>
                </div>
            </div>
        );
    }

    if (isAdmin === null) return null;

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                    <h1 className="text-2xl font-bold mb-3">Admin Access Required</h1>
                    <p className="text-gray-400 mb-6">Your Strava account is logged in but not authorized as an admin.</p>
                    <button
                        onClick={logout}
                        className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        );
    }

    return <AdminDashboard token={token} onLogout={logout} />;
}
