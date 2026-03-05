"use client";

import { useEffect, useState } from "react";
import AdminDashboard from "@/components/AdminDashboard";
import { useAuth } from "@/components/AuthContext";
import { verifyAdminAccess } from "@/utils/api";

export default function AdminPage() {
    const { isLoading, isLoggedIn, login, logout, token } = useAuth();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        if (!token) {
            setIsAdmin(null);
            return;
        }

        verifyAdminAccess(token).then(setIsAdmin).catch(() => setIsAdmin(false));
    }, [token]);

    if (isLoading) return null;

    if (!isLoggedIn || !token) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                    <h1 className="text-2xl font-bold mb-3">Admin Access</h1>
                    <p className="text-gray-400 mb-6">You must log in with Strava to continue.</p>
                    <button
                        onClick={login}
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        Login with Strava
                    </button>
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
